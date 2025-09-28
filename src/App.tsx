import React, { useState, useEffect, useRef } from 'react';
import { AIImprovement } from './components/TranscriptionPanel';
import AudioRecorder from './components/AudioRecorder';
import TranscriptionPanel from './components/TranscriptionPanel';
import RecordingHistory from './components/RecordingHistory';
import PDFExport from './components/PDFExport';
import SettingsPage from './components/SettingsPage';
import { Mic, FileText, History, Download, Settings } from 'lucide-react';

type RecordingStorageMode = 'browser' | 'directory';

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
  fileName?: string | null;
  storageMode?: RecordingStorageMode;
  storageDirectoryName?: string | null;
} & Record<string, unknown>;

type StorageMessage = {
  type: 'success' | 'error' | 'info';
  message: string;
};

const sanitizeFileName = (value: string): string => {
  const trimmed = value
    .replace(/[\x00-\x1F<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-');

  const safe = trimmed || 'voicescript-recording';
  return safe.slice(0, 64);
};

const getFileExtensionFromType = (mimeType: string): string => {
  if (!mimeType) {
    return 'webm';
  }

  if (mimeType.includes('mpeg')) {
    return 'mp3';
  }
  if (mimeType.includes('wav')) {
    return 'wav';
  }
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    return 'm4a';
  }

  return 'webm';
};

const generateRecordingFileName = (recordingId: string, title: string, mimeType: string): string => {
  const baseTitle = sanitizeFileName(title || 'voicescript');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = getFileExtensionFromType(mimeType);
  return `${baseTitle}-${recordingId}-${timestamp}.${extension}`;
};

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
  const [recordingDirectoryHandle, setRecordingDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [recordingStorageMode, setRecordingStorageMode] = useState<RecordingStorageMode>(() => {
    const stored = localStorage.getItem('voicescript-storage-mode');
    return stored === 'directory' ? 'directory' : 'browser';
  });
  const [recordingDirectoryName, setRecordingDirectoryName] = useState<string | null>(() => {
    return localStorage.getItem('voicescript-storage-directory-name');
  });
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);
  const [hasDirectoryAccess, setHasDirectoryAccess] = useState(false);
  const [storageMessage, setStorageMessage] = useState<StorageMessage | null>(null);
  const [lastSavedFileName, setLastSavedFileName] = useState<string | null>(null);
  const [transcriptionNotice, setTranscriptionNotice] = useState<StorageMessage | null>(null);

  useEffect(() => {
    currentRecordingIdRef.current = currentRecordingId;
  }, [currentRecordingId]);

  useEffect(() => {
    let isCancelled = false;

    if (!recordingDirectoryHandle) {
      setHasDirectoryAccess(false);
      return;
    }

    const verifyPermission = async () => {
      if (!recordingDirectoryHandle.queryPermission) {
        if (!isCancelled) {
          setHasDirectoryAccess(true);
        }
        return;
      }

      try {
        const status = await recordingDirectoryHandle.queryPermission({ mode: 'readwrite' });
        if (!isCancelled) {
          setHasDirectoryAccess(status === 'granted');
        }
      } catch (error) {
        console.warn('Klasör izin durumu sorgulanamadı:', error);
        if (!isCancelled) {
          setHasDirectoryAccess(false);
        }
      }
    };

    void verifyPermission();

    return () => {
      isCancelled = true;
    };
  }, [recordingDirectoryHandle]);

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

  const updateStoragePreferences = (mode: RecordingStorageMode, directoryName: string | null) => {
    setRecordingStorageMode(mode);
    setRecordingDirectoryName(directoryName);

    localStorage.setItem('voicescript-storage-mode', mode);

    if (mode === 'directory' && directoryName) {
      localStorage.setItem('voicescript-storage-directory-name', directoryName);
    } else {
      localStorage.removeItem('voicescript-storage-directory-name');
    }
  };

  const handleDismissStorageMessage = () => {
    setStorageMessage(null);
  };

  const handleDismissTranscriptionNotice = () => {
    setTranscriptionNotice(null);
  };

  const ensureDirectoryPermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
      if (!handle.queryPermission && !handle.requestPermission) {
        return true;
      }

      const queryStatus = handle.queryPermission
        ? await handle.queryPermission({ mode: 'readwrite' })
        : 'prompt';

      if (queryStatus === 'granted') {
        return true;
      }

      if (handle.requestPermission) {
        const requestStatus = await handle.requestPermission({ mode: 'readwrite' });
        return requestStatus === 'granted';
      }

      return false;
    } catch (error) {
      console.warn('Klasör izni doğrulanamadı:', error);
      return false;
    }
  };

  const selectRecordingDirectory = async () => {
    if (!window.showDirectoryPicker) {
      setStorageMessage({
        type: 'error',
        message: 'Tarayıcınız klasör seçimini desteklemiyor. Lütfen Chrome veya Edge kullanmayı deneyin.'
      });
      return;
    }

    setIsSelectingDirectory(true);
    try {
      const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

      const permissionGranted = await ensureDirectoryPermission(directoryHandle);

      if (!permissionGranted) {
        setStorageMessage({
          type: 'error',
          message: 'Klasör erişimi için izin verilmedi. Kayıtlar tarayıcı depolamasında tutulmaya devam edecek.'
        });
        return;
      }

      setRecordingDirectoryHandle(directoryHandle);
      setHasDirectoryAccess(true);
      updateStoragePreferences('directory', directoryHandle.name);
      setStorageMessage({
        type: 'success',
        message: `Yeni kayıtlar "${directoryHandle.name}" klasörüne kaydedilecek.`
      });
      setTranscriptionNotice(null);
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return;
      }

      console.error('Klasör seçimi sırasında hata:', error);
      setStorageMessage({
        type: 'error',
        message: 'Klasör seçimi başarısız oldu. Lütfen tekrar deneyin.'
      });
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const clearRecordingDirectory = () => {
    setRecordingDirectoryHandle(null);
    setHasDirectoryAccess(false);
    setLastSavedFileName(null);
    updateStoragePreferences('browser', null);
    setStorageMessage({
      type: 'info',
      message: 'Kayıtlar tekrar tarayıcı depolamasına kaydedilecek.'
    });
    setTranscriptionNotice(null);
  };

  const writeRecordingToDirectory = async (
    fileName: string,
    audioBlob: Blob,
    handle: FileSystemDirectoryHandle
  ): Promise<string | null> => {
    const permissionGranted = await ensureDirectoryPermission(handle);

    if (!permissionGranted) {
      setHasDirectoryAccess(false);
      setStorageMessage({
        type: 'error',
        message: 'Seçilen klasöre erişilemiyor. Lütfen izin verin veya farklı bir klasör seçin.'
      });
      return null;
    }

    try {
      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(audioBlob);
      await writable.close();

      setHasDirectoryAccess(true);
      setLastSavedFileName(fileName);
      setStorageMessage({
        type: 'success',
        message: `Kayıt dosyası "${fileName}" adıyla kaydedildi.`
      });

      return fileName;
    } catch (error) {
      console.error('Dosya yazma sırasında hata:', error);
      setStorageMessage({
        type: 'error',
        message: 'Ses dosyası seçilen klasöre kaydedilemedi. Lütfen tarayıcı izinlerini kontrol edin.'
      });
      return null;
    }
  };

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
      const effectiveDuration = typeof durationSeconds === 'number' && durationSeconds > 0
        ? durationSeconds
        : recordingTime;

      const existingId = currentRecordingIdRef.current;
      const recordingsSnapshot = recordings;
      const existingIndexSnapshot = existingId
        ? recordingsSnapshot.findIndex((recording) => recording.id === existingId)
        : -1;

      const isNewRecording = existingIndexSnapshot === -1;
      const recordingId = isNewRecording ? Date.now().toString() : existingId ?? Date.now().toString();
      const defaultTitle = `Kayıt - ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`;
      const existingRecording = existingIndexSnapshot >= 0 ? recordingsSnapshot[existingIndexSnapshot] : null;
      const recordingTitle = existingRecording?.title ?? defaultTitle;

      let fileNameForDirectory = existingRecording?.fileName ?? null;
      let storageModeForRecording: RecordingStorageMode = existingRecording?.storageMode ?? 'browser';
      let storageDirectoryNameForRecording = existingRecording?.storageDirectoryName ?? null;
      let audioBase64: string | null = null;
      let usedDirectoryStorage = false;
      let resolvedDirectoryName: string | null = null;

      if (currentAudio) {
        if (recordingDirectoryHandle) {
          resolvedDirectoryName = recordingDirectoryName ?? recordingDirectoryHandle.name;
          const candidateName = fileNameForDirectory
            ?? generateRecordingFileName(recordingId, recordingTitle, currentAudio.type || 'audio/webm');

          const savedFileName = await writeRecordingToDirectory(candidateName, currentAudio, recordingDirectoryHandle);

          if (savedFileName) {
            usedDirectoryStorage = true;
            fileNameForDirectory = savedFileName;
            storageModeForRecording = 'directory';
            storageDirectoryNameForRecording = resolvedDirectoryName;
            if (!recordingDirectoryName) {
              updateStoragePreferences('directory', resolvedDirectoryName);
            }
          }
        }

        if (!usedDirectoryStorage) {
          const previousFileName = fileNameForDirectory;
          try {
            audioBase64 = await blobToBase64(currentAudio);
          } catch (conversionError) {
            console.warn('Ses dosyası base64\'e çevrilemedi:', conversionError);
            audioBase64 = existingRecording?.audioData ?? null;
          }

          if (storageModeForRecording === 'directory') {
            storageModeForRecording = 'browser';
            storageDirectoryNameForRecording = null;
          }

          fileNameForDirectory = null;

          // Yeni kayıt tarayıcı deposunda kalıyorsa son kaydedilen dosya ismini temizle
          setLastSavedFileName((prev) => (prev && prev === previousFileName ? null : prev));
        } else {
          // Klasöre kaydedildiyse tarayıcı depolamasındaki büyük blobu tutmaya gerek yok
          audioBase64 = null;
          setLastSavedFileName(fileNameForDirectory);
        }
      }

      const baseRecording: StoredRecording = existingRecording
        ? {
            ...existingRecording,
          }
        : {
            id: recordingId,
            title: recordingTitle,
            timestamp: new Date().toISOString(),
            duration: effectiveDuration,
            rawTranscript: currentTranscript,
            geminiTranscript: '',
            processedTranscript: '',
            aiImprovedTranscript: '',
            quality: 'medium',
            audioData: null,
            audioType: currentAudio?.type || 'audio/webm',
            speakerCount: 1,
            fileName: null,
            storageMode: 'browser',
            storageDirectoryName: null,
          };

      baseRecording.timestamp = new Date().toISOString();
      baseRecording.duration = effectiveDuration;
      baseRecording.rawTranscript = currentTranscript;
      baseRecording.geminiTranscript = geminiTranscription;
      baseRecording.processedTranscript = processedTranscript;
      baseRecording.aiImprovedTranscript = aiImprovedTranscript;
      baseRecording.fileName = fileNameForDirectory;
      baseRecording.storageMode = storageModeForRecording;
      baseRecording.storageDirectoryName = storageDirectoryNameForRecording;

      if (currentAudio) {
        baseRecording.audioType = currentAudio.type || baseRecording.audioType || 'audio/webm';

        if (usedDirectoryStorage) {
          baseRecording.audioData = null;
        } else if (audioBase64) {
          baseRecording.audioData = audioBase64;
        } else if (!isNewRecording) {
          baseRecording.audioData = existingRecording?.audioData ?? null;
        }
      } else if (existingRecording) {
        baseRecording.audioData = existingRecording.audioData;
        baseRecording.audioType = existingRecording.audioType;
      }

      if (isNewRecording) {
        console.log('Yeni kayıt ekleniyor:', {
          id: baseRecording.id,
          storageMode: baseRecording.storageMode,
          duration: effectiveDuration,
        });

        setCurrentRecordingId(baseRecording.id);
        currentRecordingIdRef.current = baseRecording.id;

        setRecordings((prevRecordings) => persistRecordings([...prevRecordings, baseRecording]));
      } else {
        console.log('Mevcut kayıt güncelleniyor:', {
          id: baseRecording.id,
          storageMode: baseRecording.storageMode,
          transcriptLength: baseRecording.rawTranscript.length,
        });

        setRecordings((prevRecordings) => {
          const updatedRecordings = prevRecordings.map((recording) => (
            recording.id === baseRecording.id ? baseRecording : recording
          ));

          return persistRecordings(updatedRecordings);
        });
      }

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


  const handleLoadRecording = async (recording: unknown) => {
    const rec = recording as {
      id?: string;
      rawTranscript?: string;
      geminiTranscript?: string;
      processedTranscript?: string;
      aiImprovedTranscript?: string;
      audioData?: string;
      audioType?: string;
      timestamp?: string;
      fileName?: string | null;
      storageMode?: RecordingStorageMode;
      storageDirectoryName?: string | null;
    };

    console.log('Kayıt yükleniyor:', rec);

    setTranscriptionNotice(null);

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
    let loadedAudio: Blob | null = null;

    if (rec.storageMode === 'directory' && rec.fileName) {
      if (recordingDirectoryHandle) {
        const permissionGranted = await ensureDirectoryPermission(recordingDirectoryHandle);

        if (permissionGranted) {
          try {
            const fileHandle = await recordingDirectoryHandle.getFileHandle(rec.fileName);
            const file = await fileHandle.getFile();
            loadedAudio = file;
            setHasDirectoryAccess(true);
            setLastSavedFileName(rec.fileName);
            console.log('Klasörden ses dosyası okundu:', rec.fileName, file.size, 'bytes');
            setTranscriptionNotice(null);
          } catch (fileError) {
            console.warn('Klasörden ses dosyası okunamadı:', fileError);
            setHasDirectoryAccess(false);
            setStorageMessage({
              type: 'error',
              message: `"${rec.fileName}" dosyasına erişilemedi. Lütfen klasör izinlerini kontrol edin veya kaydı yeniden alın.`
            });
            setTranscriptionNotice({
              type: 'error',
              message: `"${rec.fileName}" dosyasına erişilemedi. Lütfen klasör izinlerini kontrol edin veya kaydı yeniden alın.`
            });
          }
        } else {
          setHasDirectoryAccess(false);
          setStorageMessage({
            type: 'error',
            message: 'Kayıt dosyasını okumak için klasör izni verilmedi. Ayarlar bölümünden klasör erişimini yeniden onaylayın.'
          });
          setTranscriptionNotice({
            type: 'error',
            message: 'Kayıt dosyasını okumak için klasör izni verilmedi. Ayarlar bölümünden klasör erişimini yeniden onaylayın.'
          });
        }
      } else {
        setHasDirectoryAccess(false);
        setStorageMessage({
          type: 'info',
          message: 'Bu kaydı açmak için daha önce seçtiğiniz klasörü yeniden seçmeniz gerekiyor.'
        });
        setTranscriptionNotice({
          type: 'info',
          message: 'Bu kaydı açmak için daha önce seçtiğiniz klasörü yeniden seçmeniz gerekiyor.'
        });
      }
    }

    if (!loadedAudio && rec.audioData && rec.audioType) {
      try {
        const audioBlob = base64ToBlob(rec.audioData, rec.audioType);
        loadedAudio = audioBlob;
        console.log('Base64 ses dosyası yüklendi:', audioBlob.size, 'bytes');
      } catch (error) {
        console.warn('Base64 ses dosyası yüklenemedi:', error);
      }
    }

    if (!loadedAudio) {
      console.log('Ses dosyası yüklenemedi, recordedAudio null olarak ayarlanıyor.');
    }

    setRecordedAudio(loadedAudio);

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
                  recordingStorageMode={recordingStorageMode}
                  recordingDirectoryName={recordingDirectoryName}
                  onSelectStorageDirectory={selectRecordingDirectory}
                  isSelectingStorageDirectory={isSelectingDirectory}
                  hasDirectoryAccess={hasDirectoryAccess}
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
                  noticeMessage={transcriptionNotice}
                  onDismissNotice={handleDismissTranscriptionNotice}
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
                <SettingsPage
                  recordingStorageMode={recordingStorageMode}
                  recordingDirectoryName={recordingDirectoryName}
                  onSelectRecordingDirectory={selectRecordingDirectory}
                  onClearRecordingDirectory={clearRecordingDirectory}
                  isSelectingDirectory={isSelectingDirectory}
                  hasDirectoryAccess={hasDirectoryAccess}
                  lastSavedFileName={lastSavedFileName}
                  storageMessage={storageMessage}
                  onDismissStorageMessage={handleDismissStorageMessage}
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
