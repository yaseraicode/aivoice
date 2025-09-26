import React, { useState, useEffect, useRef } from 'react';
import { AIImprovement } from './components/TranscriptionPanel';
import AudioRecorder from './components/AudioRecorder';
import TranscriptionPanel from './components/TranscriptionPanel';
import RecordingHistory from './components/RecordingHistory';
import PDFExport from './components/PDFExport';
import SettingsPage from './components/SettingsPage';
import { Mic, FileText, History, Download, Settings } from 'lucide-react';

type StoredRecording = {
  id: string;
  title: string;
  timestamp: string;
  duration: number;
  rawTranscript: string;
  geminiTranscript: string;
  processedTranscript: string;
  aiImprovedTranscript: string;
  quality: string;
  audioData: string | null;
  audioType: string;
  speakerCount: number;
} & Record<string, unknown>;

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [transcript, setTranscript] = useState('');
  const [processedTranscript, setProcessedTranscript] = useState('');
  const [aiImprovedTranscript, setAiImprovedTranscript] = useState('');
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [realtimeText, setRealtimeText] = useState('');
  const [geminiTranscription, setGeminiTranscription] = useState('');
  const [aiImprovement, setAiImprovement] = useState<AIImprovement | null>(null);
  const [recordings, setRecordings] = useState<StoredRecording[]>(() => {
    const saved = localStorage.getItem('voicescript-recordings');
    return saved ? (JSON.parse(saved) as StoredRecording[]) : [];
  });
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const currentRecordingIdRef = useRef<string | null>(null);
  const isSavingRecordingRef = useRef(false);

  useEffect(() => {
    currentRecordingIdRef.current = currentRecordingId;
  }, [currentRecordingId]);

  useEffect(() => {
    if (isRecording) {
      setGeminiTranscription('');
      setProcessedTranscript('');
      setAiImprovedTranscript('');
      setAiImprovement(null);
      setCurrentRecordingId(null);
      currentRecordingIdRef.current = null;
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      return;
    }

    const activeRecordingId = currentRecordingIdRef.current;
    const trimmedTranscript = transcript.trim();

    if (!activeRecordingId || !trimmedTranscript) {
      return;
    }

    setRecordings((prevRecordings) => {
      if (prevRecordings.length === 0) {
        return prevRecordings;
      }

      const nextRecordings = prevRecordings.map((recording) => {
        if (recording.id !== activeRecordingId) {
          return recording;
        }

        if (recording.rawTranscript === trimmedTranscript) {
          return recording;
        }

        return {
          ...recording,
          rawTranscript: trimmedTranscript,
        };
      });

      return persistRecordings(nextRecordings);
    });
  }, [isRecording, transcript]);

  const persistRecordings = (records: StoredRecording[]): StoredRecording[] => {
    try {
      localStorage.setItem('voicescript-recordings', JSON.stringify(records));
      console.log('Kayıtlar yerel depoya yazıldı. Toplam kayıt sayısı:', records.length);
      return records;
    } catch (error) {
      console.warn('localStorage yazılırken kota aşıldı, son 5 kayıt tutuluyor...', error);

      const recentRecordings = records.slice(-5);

      try {
        localStorage.setItem('voicescript-recordings', JSON.stringify(recentRecordings));
        console.log('Kota temizliği sonrası 5 kayıt saklandı. Kayıt sayısı:', recentRecordings.length);
        return recentRecordings;
      } catch (secondError) {
        console.error('localStorage hala kaydedilemiyor, yalnızca son kayıt saklanacak:', secondError);

        const currentRecording = records[records.length - 1];
        if (currentRecording) {
          try {
            localStorage.setItem('voicescript-recordings', JSON.stringify([currentRecording]));
            console.log('Sadece mevcut kayıt saklandı. ID:', currentRecording.id);
            return [currentRecording];
          } catch (thirdError) {
            console.error('Tek kaydı saklama denemesi başarısız oldu:', thirdError);
          }
        }

        localStorage.removeItem('voicescript-recordings');
        console.log('Kayıtlar yerel depodan temizlendi.');
        return [];
      }
    }
  };

  // Update legacy state when aiImprovement changes
  useEffect(() => {
    if (aiImprovement) {
      setProcessedTranscript(aiImprovement.improved);
      setAiImprovedTranscript(aiImprovement.improved);
    }
  }, [aiImprovement]);

  const saveCurrentRecording = async (audioBlob?: Blob, transcriptText?: string, durationSeconds?: number) => {
    if (isSavingRecordingRef.current) {
      console.log('saveCurrentRecording skipped: previous save still in progress');
      return;
    }

    isSavingRecordingRef.current = true;

    const currentAudio = audioBlob || recordedAudio;
    const transcriptCandidates = [transcriptText, transcript, realtimeText];
    const currentTranscript = transcriptCandidates.find(
      (text): text is string => Boolean(text && text.trim().length > 0)
    ) ?? '';

    if (!currentTranscript && !geminiTranscription && !currentAudio) {
      console.log('Kayıt kaydedilmedi: Transkript boş');
      isSavingRecordingRef.current = false;
      return;
    }

    try {
      let audioBase64: string | null = null;
      if (currentAudio) {
        try {
          audioBase64 = await blobToBase64(currentAudio);
        } catch (error) {
          console.warn('Ses dosyası base64\'e çevrilemedi:', error);
        }
      }

      const effectiveDuration = typeof durationSeconds === 'number' && durationSeconds > 0
        ? durationSeconds
        : recordingTime;

      setRecordings((prevRecordings) => {
        const existingId = currentRecordingIdRef.current;
        const existingIndex = existingId
          ? prevRecordings.findIndex((recording) => recording.id === existingId)
          : -1;

        const isNewRecording = existingIndex === -1;
        const recordingId = isNewRecording ? Date.now().toString() : existingId ?? Date.now().toString();
        const baseRecording: StoredRecording = {
          id: recordingId,
          title: `Kayıt - ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`,
          timestamp: new Date().toISOString(),
          duration: effectiveDuration,
          rawTranscript: currentTranscript,
          geminiTranscript: isNewRecording ? '' : geminiTranscription,
          processedTranscript: isNewRecording ? '' : processedTranscript,
          aiImprovedTranscript: isNewRecording ? '' : aiImprovedTranscript,
          quality: 'medium',
          audioData: audioBase64,
          audioType: currentAudio?.type || 'audio/webm',
          speakerCount: 1
        };

        if (isNewRecording) {
          console.log('Yeni kayıt ekleniyor:', {
            id: baseRecording.id,
            audioData: baseRecording.audioData ? `${baseRecording.audioData.length} karakter` : 'yok',
            duration: effectiveDuration,
          });

          setCurrentRecordingId(baseRecording.id);
          currentRecordingIdRef.current = baseRecording.id;
          return persistRecordings([...prevRecordings, baseRecording]);
        }

        console.log('Mevcut kayıt güncelleniyor:', {
          id: baseRecording.id,
          audioLength: effectiveDuration,
          transcriptLength: baseRecording.rawTranscript.length,
        });

        const updatedRecordings = prevRecordings.map((recording, index) => {
          if (index !== existingIndex) {
            return recording;
          }

          return {
            ...recording,
            duration: effectiveDuration,
            rawTranscript: currentTranscript,
            geminiTranscript: geminiTranscription,
            processedTranscript: processedTranscript,
            aiImprovedTranscript: aiImprovedTranscript,
            audioData: audioBase64,
            audioType: currentAudio?.type || recording.audioType,
          };
        });

        return persistRecordings(updatedRecordings);
      });

      if (effectiveDuration > 0) {
        setRecordingTime(effectiveDuration);
      }
    } catch (error) {
      console.error('Kayıt kaydetme hatası:', error);
    } finally {
      isSavingRecordingRef.current = false;
    }
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Helper function to convert base64 back to blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };


  const handleLoadRecording = (recording: unknown) => {
    const rec = recording as {
      id?: string;
      rawTranscript?: string;
      geminiTranscript?: string;
      processedTranscript?: string;
      aiImprovedTranscript?: string;
      audioData?: string;
      audioType?: string;
      timestamp?: string;
    };

    console.log('Kayıt yükleniyor:', rec);

    // Aktif kayıt ID'sini ayarla
    setCurrentRecordingId(rec.id || null);

    // Önceki state'leri temizle
    setTranscript('');
    setGeminiTranscription('');
    setProcessedTranscript('');
    setAiImprovedTranscript('');
    setAiImprovement(null);
    setRealtimeText('');
    setRecordingTime(rec.duration ?? 0);

    // Yeni kaydın verilerini yükle
    setTranscript(rec.rawTranscript || '');
    setGeminiTranscription(rec.geminiTranscript || '');
    setProcessedTranscript(rec.processedTranscript || '');
    setAiImprovedTranscript(rec.aiImprovedTranscript || '');

    // Load audio data if available
    if (rec.audioData && rec.audioType) {
      try {
        const audioBlob = base64ToBlob(rec.audioData, rec.audioType);
        setRecordedAudio(audioBlob);
        console.log('Ses dosyası yüklendi:', audioBlob.size, 'bytes');
      } catch (error) {
        console.warn('Ses dosyası yüklenemedi:', error);
        setRecordedAudio(null);
      }
    } else {
      setRecordedAudio(null);
    }

    // Load AI improvement if available
    if (rec.aiImprovedTranscript) {
      const improvement = {
        original: rec.rawTranscript || rec.geminiTranscript || '',
        improved: rec.aiImprovedTranscript,
        improvementType: 'detailed' as const,
        timestamp: new Date(rec.timestamp || Date.now())
      };
      setAiImprovement(improvement);
    } else {
      setAiImprovement(null);
    }

    setActiveTab('transcription');
  };

  const handleRecordingComplete = (audioBlob: Blob, finalText: string, durationSeconds: number) => {
    console.log('Recording completed:', { audioBlobSize: audioBlob.size, finalTextLength: finalText.length, durationSeconds });
    console.log('Final text content:', finalText);
    console.log('Current transcript before update:', transcript);

    setRecordedAudio(audioBlob);
    setTranscript(finalText);
    if (durationSeconds > 0) {
      setRecordingTime(durationSeconds);
    }

    console.log('Transcript after update:', finalText);
    console.log('Current recording ID before save:', currentRecordingId);

    // Otomatik kaydetme - kayıt tamamlandığında
    void saveCurrentRecording(audioBlob, finalText, durationSeconds);
  };

  const handleDeleteRecording = (id: string) => {
    setRecordings((prevRecordings) => persistRecordings(prevRecordings.filter(recording => recording.id !== id)));
  };

  const handleUpdateRecording = (id: string, updates: Partial<StoredRecording>) => {
    setRecordings((prevRecordings) => {
      if (prevRecordings.length === 0) {
        return prevRecordings;
      }

      const fallbackId = currentRecordingIdRef.current;
      const targetId = id || fallbackId;

      if (!targetId) {
        return prevRecordings;
      }

      const updatedRecordings = prevRecordings.map((recording) =>
        recording.id === targetId ? { ...recording, ...updates } : recording
      );

      return persistRecordings(updatedRecordings);
    });
  };

  const tabs = [
    { id: 'record', label: 'Kayıt', icon: Mic },
    { id: 'transcription', label: 'Transkripsiyon', icon: FileText },
    { id: 'history', label: 'Kayıt Geçmişi', icon: History },
    { id: 'export', label: 'PDF Dışa Aktar', icon: Download },
    { id: 'settings', label: 'Ayarlar', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Modern Header */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-white/20 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  VoiceScript Pro
                </h1>
                <p className="text-sm text-gray-600 font-medium">AI-Powered Voice Transcription</p>
              </div>
            </div>
          </header>

          {/* Modern Card Container */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
            {/* Modern Navigation */}
            <nav className="flex bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200/50">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isDisabled = isRecording && tab.id !== 'record';
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`flex-1 flex items-center justify-center gap-3 px-8 py-5 font-semibold transition-all duration-300 relative group ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : isDisabled
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50/50'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50/50 group-hover:shadow-md'
                    }`}
                  >
                    <Icon size={22} className={`transition-transform duration-300 ${
                      activeTab === tab.id ? 'scale-110' : 'group-hover:scale-105'
                    }`} />
                    <span className="hidden sm:block">{tab.label}</span>
                    {isDisabled && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg" title="Kayıt sırasında devre dışı">
                        <div className="w-full h-full bg-red-400 rounded-full animate-ping"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>

            <main className="p-6">
              {/* Recording Warning Modal */}
              {isRecording && activeTab !== 'record' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                        <Mic className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Kayıt Devam Ediyor</h3>
                        <p className="text-sm text-gray-600">Kayıt sırasında sekme değiştiremezsiniz</p>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setActiveTab('record')}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Kayıt Sekmesine Dön
                      </button>
                      <button
                        onClick={() => {
                          // Stop recording and allow tab switch
                          setIsRecording(false);
                          setActiveTab(activeTab);
                        }}
                        className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Kaydı Durdur
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'record' && (
                <AudioRecorder
                  onRecordingComplete={handleRecordingComplete}
                  transcript={transcript}
                  setTranscript={setTranscript}
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                  recordingTime={recordingTime}
                  setRecordingTime={setRecordingTime}
                  realtimeText={realtimeText}
                  setRealtimeText={setRealtimeText}
                  geminiTranscription={geminiTranscription}
                  setGeminiTranscription={setGeminiTranscription}
                />
              )}

              {activeTab === 'transcription' && (
                <TranscriptionPanel
                  transcript={transcript}
                  setTranscript={setTranscript}
                  aiImprovement={aiImprovement}
                  setAiImprovement={setAiImprovement}
                  geminiTranscription={geminiTranscription}
                  setGeminiTranscription={setGeminiTranscription}
                  recordedAudio={recordedAudio}
                  isRecording={isRecording}
                  currentRecordingId={currentRecordingId}
                  recordingDuration={recordingTime}
                  onSaveRecording={() => {
                    void saveCurrentRecording();
                  }}
                  onUpdateRecording={handleUpdateRecording}
                />
              )}

              {activeTab === 'history' && (
                <RecordingHistory
                  recordings={recordings}
                  onLoadRecording={handleLoadRecording}
                  activeRecordingId={currentRecordingId}
                  onDeleteRecording={handleDeleteRecording}
                  onUpdateRecording={handleUpdateRecording}
                />
              )}

              {activeTab === 'export' && (
                <PDFExport
                  transcript={transcript}
                  aiImprovementData={aiImprovement}
                  recordingInfo={{
                    duration: recordingTime,
                    quality: 'medium',
                    startTime: new Date()
                  }}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage />
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
