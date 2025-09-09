import React, { useState, useEffect } from 'react';
import { AIImprovement } from './components/TranscriptionPanel';
import AudioRecorder from './components/AudioRecorder';
import TranscriptionPanel from './components/TranscriptionPanel';
import RecordingHistory from './components/RecordingHistory';
import PDFExport from './components/PDFExport';
import SettingsPage from './components/SettingsPage';
import { Mic, FileText, History, Download, Settings } from 'lucide-react';

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
  const [recordings, setRecordings] = useState<any[]>(() => {
    const saved = localStorage.getItem('voicescript-recordings');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

  // Update legacy state when aiImprovement changes
  useEffect(() => {
    if (aiImprovement) {
      setProcessedTranscript(aiImprovement.improved);
      setAiImprovedTranscript(aiImprovement.improved);
    }
  }, [aiImprovement]);

  const saveCurrentRecording = (audioBlob?: Blob, transcriptText?: string) => {
    const currentAudio = audioBlob || recordedAudio;
    const currentTranscript = transcriptText || transcript;
    
    if (!currentTranscript && !geminiTranscription && !currentAudio) {
      console.log('Kayıt kaydedilmedi: Transkript boş');
      return;
    }

    try {
      // Convert audio blob to base64 for storage
      const saveRecordingData = async () => {
        let audioBase64 = null;
        if (currentAudio) {
          try {
            audioBase64 = await blobToBase64(currentAudio);
          } catch (error) {
            console.warn('Ses dosyası base64\'e çevrilemedi:', error);
          }
        }

        const newRecordingId = Date.now().toString();
        const recordingData = {
          id: newRecordingId,
          title: `Kayıt - ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`,
          timestamp: new Date().toISOString(),
          duration: recordingTime,
          rawTranscript: currentTranscript,
          geminiTranscript: geminiTranscription,
          processedTranscript: processedTranscript,
          aiImprovedTranscript: aiImprovedTranscript,
          quality: 'medium',
          audioData: audioBase64,
          audioType: currentAudio?.type || 'audio/webm',
          speakerCount: 1
        };

        console.log('Kayıt kaydediliyor:', {
          ...recordingData,
          audioData: audioBase64 ? `${audioBase64.length} karakter` : 'yok'
        });

        const updatedRecordings = [...recordings, recordingData];
        setRecordings(updatedRecordings);

        // Yeni kaydın ID'sini aktif kayıt olarak ayarla
        setCurrentRecordingId(newRecordingId);

        // Try to save to localStorage with error handling
        try {
          localStorage.setItem('voicescript-recordings', JSON.stringify(updatedRecordings));
          console.log('Kayıt başarıyla kaydedildi. Toplam kayıt sayısı:', updatedRecordings.length);
        } catch (error) {
          console.warn('localStorage quota exceeded during save, cleaning up...');

          // If quota exceeded, keep only the most recent 5 recordings
          const recentRecordings = updatedRecordings.slice(0, 5);
          setRecordings(recentRecordings);

          try {
            localStorage.setItem('voicescript-recordings', JSON.stringify(recentRecordings));
            console.log('Cleaned up recordings during save, kept only the 5 most recent ones');
          } catch (secondError) {
            console.error('Still unable to save to localStorage during save operation:', secondError);
            // Clear all except current
            const currentRecording = updatedRecordings[updatedRecordings.length - 1];
            if (currentRecording) {
              setRecordings([currentRecording]);
              try {
                localStorage.setItem('voicescript-recordings', JSON.stringify([currentRecording]));
                console.log('Kept only the current recording during save operation');
              } catch (thirdError) {
                console.error('Unable to save even current recording:', thirdError);
                localStorage.removeItem('voicescript-recordings');
                setRecordings([]);
              }
            }
          }
        }
      };

      saveRecordingData();
    } catch (error) {
      console.error('Kayıt kaydetme hatası:', error);
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
    setRecordingTime(0);

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

  const handleRecordingComplete = (audioBlob: Blob, finalText: string) => {
    console.log('Recording completed:', { audioBlobSize: audioBlob.size, finalTextLength: finalText.length });
    console.log('Final text content:', finalText);
    console.log('Current transcript before update:', transcript);

    setRecordedAudio(audioBlob);
    setTranscript(finalText);

    console.log('Transcript after update:', finalText);
    console.log('Current recording ID before save:', currentRecordingId);

    // Otomatik kaydetme - kayıt tamamlandığında
    saveCurrentRecording(audioBlob, finalText);
  };

  const handleDeleteRecording = (id: string) => {
    const updatedRecordings = recordings.filter(recording => recording.id !== id);
    setRecordings(updatedRecordings);

    try {
      localStorage.setItem('voicescript-recordings', JSON.stringify(updatedRecordings));
    } catch (error) {
      console.warn('localStorage quota exceeded during delete operation:', error);
      // If quota exceeded during delete, try to save with cleanup
      try {
        const recentRecordings = updatedRecordings.slice(0, 5);
        setRecordings(recentRecordings);
        localStorage.setItem('voicescript-recordings', JSON.stringify(recentRecordings));
        console.log('Cleaned up recordings during delete operation');
      } catch (secondError) {
        console.error('Unable to save after cleanup during delete:', secondError);
        localStorage.removeItem('voicescript-recordings');
        setRecordings([]);
      }
    }
  };

  const handleUpdateRecording = (id: string, updates: unknown) => {
    let updatedRecordings;

    if (!id && recordings.length > 0) {
      // If no ID provided, update the most recent recording
      const mostRecentRecording = recordings[0];
      updatedRecordings = recordings.map(recording =>
        recording.id === mostRecentRecording.id
          ? { ...recording, ...(updates as Record<string, unknown>) }
          : recording
      );
    } else {
      // Update specific recording by ID
      updatedRecordings = recordings.map(recording => {
        const rec = recording as Record<string, unknown>;
        return (rec.id === id) ? { ...rec, ...(updates as Record<string, unknown>) } : rec;
      });
    }

    setRecordings(updatedRecordings);

    // Try to save to localStorage with error handling
    try {
      localStorage.setItem('voicescript-recordings', JSON.stringify(updatedRecordings));
    } catch (error) {
      console.warn('localStorage quota exceeded, cleaning up old recordings...');

      // If quota exceeded, keep only the most recent 5 recordings
      const recentRecordings = updatedRecordings.slice(0, 5);
      setRecordings(recentRecordings);

      try {
        localStorage.setItem('voicescript-recordings', JSON.stringify(recentRecordings));
        console.log('Cleaned up recordings, kept only the 5 most recent ones');
      } catch (secondError) {
        console.error('Still unable to save to localStorage:', secondError);
        // If still failing, clear all recordings except the current one
        const currentRecording = updatedRecordings[0];
        if (currentRecording) {
          const minimalRecordings = [currentRecording];
          setRecordings(minimalRecordings);
          try {
            localStorage.setItem('voicescript-recordings', JSON.stringify(minimalRecordings));
            console.log('Kept only the current recording due to storage limitations');
          } catch (thirdError) {
            console.error('Critical: Unable to save even minimal data to localStorage:', thirdError);
            // Last resort: clear localStorage completely
            localStorage.removeItem('voicescript-recordings');
            setRecordings([]);
            console.log('Cleared all recordings from localStorage due to quota issues');
          }
        }
      }
    }
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
                  onSaveRecording={() => saveCurrentRecording()}
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
