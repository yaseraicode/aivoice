import React, { useState, useEffect } from 'react';
import { AIImprovement } from './components/TranscriptionPanel';
import AudioRecorder from './components/AudioRecorder';
import TranscriptionPanel from './components/TranscriptionPanel';
import RecordingHistory from './components/RecordingHistory';
import PDFExport from './components/PDFExport';
import { Mic, FileText, History, Download } from 'lucide-react';

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
  const [recordings, setRecordings] = useState<unknown[]>(() => {
    const saved = localStorage.getItem('voicescript-recordings');
    return saved ? JSON.parse(saved) : [];
  });

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

        const recordingData = {
          id: Date.now().toString(),
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
        localStorage.setItem('voicescript-recordings', JSON.stringify(updatedRecordings));

        console.log('Kayıt başarıyla kaydedildi. Toplam kayıt sayısı:', updatedRecordings.length);
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
      rawTranscript?: string;
      geminiTranscript?: string;
      processedTranscript?: string;
      aiImprovedTranscript?: string;
      audioData?: string;
      audioType?: string;
      timestamp?: string;
    };

    console.log('Kayıt yükleniyor:', rec);
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
    setRecordedAudio(audioBlob);
    setTranscript(finalText);
    
    // Otomatik kaydetme - kayıt tamamlandığında
    saveCurrentRecording(audioBlob, finalText);
    saveCurrentRecording();
  };

  const handleDeleteRecording = (id: string) => {
    const updatedRecordings = recordings.filter(recording => recording.id !== id);
    setRecordings(updatedRecordings);
    localStorage.setItem('voicescript-recordings', JSON.stringify(updatedRecordings));
  };

  const handleUpdateRecording = (id: string, updates: unknown) => {
    const updatedRecordings = recordings.map(recording => {
      const rec = recording as Record<string, unknown>;
      return (rec.id === id) ? { ...rec, ...(updates as Record<string, unknown>) } : rec;
    });
    setRecordings(updatedRecordings);
    localStorage.setItem('voicescript-recordings', JSON.stringify(updatedRecordings));
  };

  const tabs = [
    { id: 'record', label: 'Kayıt', icon: Mic },
    { id: 'transcription', label: 'Transkripsiyon', icon: FileText },
    { id: 'history', label: 'Kayıt Geçmişi', icon: History },
    { id: 'export', label: 'PDF Dışa Aktar', icon: Download }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">VoiceScript Pro</h1>
            <p className="text-gray-600">Profesyonel Ses Transkripsiyon Aracı</p>
          </header>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <nav className="flex border-b border-gray-200">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isDisabled = isRecording && tab.id !== 'record';
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors relative ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : isDisabled
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={20} />
                    {tab.label}
                    {isDisabled && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" title="Kayıt sırasında devre dışı"></div>
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
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                  realtimeText={realtimeText}
                  setRealtimeText={setRealtimeText}
                />
              )}

              {activeTab === 'transcription' && (
                <TranscriptionPanel
                  transcript={transcript}
                  aiImprovement={aiImprovement}
                  setAiImprovement={setAiImprovement}
                  geminiTranscription={geminiTranscription}
                  setGeminiTranscription={setGeminiTranscription}
                  recordedAudio={recordedAudio}
                  isRecording={isRecording}
                  onSaveRecording={() => saveCurrentRecording()}
                />
              )}

              {activeTab === 'history' && (
                <RecordingHistory
                  recordings={recordings}
                  onLoadRecording={handleLoadRecording}
                  onDeleteRecording={handleDeleteRecording}
                  onUpdateRecording={handleUpdateRecording}
                />
              )}

              {activeTab === 'export' && (
                <PDFExport
                  transcript={transcript}
                  aiImprovementData={aiImprovement}
                />
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
