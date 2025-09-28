import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Volume2, Users, FolderPlus, ShieldCheck } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, finalTranscription: string, durationSeconds: number) => void;
  transcript: string;
  setTranscript: (text: string) => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  recordingTime: number;
  setRecordingTime: (time: number) => void;
  realtimeText: string;
  setRealtimeText: (text: string) => void;
  geminiTranscription: string;
  setGeminiTranscription: (text: string) => void;
  recordingStorageMode: 'browser' | 'directory';
  recordingDirectoryName: string | null;
  onSelectStorageDirectory: () => void;
  isSelectingStorageDirectory: boolean;
  hasDirectoryAccess: boolean;
}

type AudioSource = 'microphone' | 'system' | 'both';

export default function AudioRecorder({
  onRecordingComplete,
  transcript,
  setTranscript,
  isRecording,
  setIsRecording,
  recordingTime,
  setRecordingTime,
  realtimeText,
  setRealtimeText,
  geminiTranscription,
  setGeminiTranscription,
  recordingStorageMode,
  recordingDirectoryName,
  onSelectStorageDirectory,
  isSelectingStorageDirectory,
  hasDirectoryAccess
}: AudioRecorderProps) {
  const [audioSource, setAudioSource] = useState<AudioSource>('microphone');
  const [isSupported, setIsSupported] = useState(true);
  const [hasDisplayMediaSupport, setHasDisplayMediaSupport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSystemGuide, setShowSystemGuide] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingTimer, setRecordingTimer] = useState<number | null>(null);
  const finalDurationRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const interimTextRef = useRef<string>('');
  const finalTextRef = useRef<string>('');

  useEffect(() => {
    // Check browser support
    const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasMediaRecorder = 'MediaRecorder' in window;
    const hasDisplayMedia = navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices;
    
    setHasDisplayMediaSupport(hasDisplayMedia);
    
    if (!hasWebSpeech || !hasMediaRecorder) {
      setIsSupported(false);
      setError('Bu tarayıcı ses kaydı ve transkripsiyon özelliklerini desteklemiyor.');
    }
    
    // If display media is not supported and user has selected system or both, switch to microphone
    if (!hasDisplayMedia && (audioSource === 'system' || audioSource === 'both')) {
      setAudioSource('microphone');
      setError('Sistem sesi yakalama bu tarayıcıda desteklenmiyor. Mikrofon moduna geçildi.');
    }

  }, []);

  useEffect(() => {
    if ((audioSource === 'system' || audioSource === 'both') && hasDisplayMediaSupport) {
      setShowSystemGuide(true);
    }
  }, [audioSource, hasDisplayMediaSupport]);

  const formatElapsedTime = (totalSeconds: number): string => {
    if (!Number.isFinite(totalSeconds)) {
      return '00:00';
    }

    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const setupSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'tr-TR';
    
    recognition.onstart = () => {
      console.log('Speech recognition started');
      setError(null);
    };
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        const startedAt = recordingStartTimeRef.current;
        const elapsedSeconds = startedAt
          ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          : recordingTime;
        const formattedText = `[${formatElapsedTime(elapsedSeconds)}] ${finalTranscript}\n`;

        const newText = finalTextRef.current + formattedText;
        finalTextRef.current = newText;
        setRealtimeText(newText);
        // Update the transcript prop immediately for persistence
        setTranscript(newText);
      }

      // Interim results için geçici gösterim (gri renkte)
      if (interimTranscript) {
        interimTextRef.current = interimTranscript;
        const startedAt = recordingStartTimeRef.current;
        const elapsedSeconds = startedAt
          ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          : recordingTime;
        const tempText = `${finalTextRef.current}[${formatElapsedTime(elapsedSeconds)}] ${interimTranscript}...`;
        setRealtimeText(tempText);
        // Also update transcript for interim results to show progress
        setTranscript(tempText);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından mikrofon erişimini etkinleştirin.');
      } else if (event.error === 'network') {
        setError('Ağ bağlantısı sorunu. İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
      } else if (event.error === 'no-speech') {
        setError('Ses algılanamadı. Mikrofonunuzun çalıştığından emin olun.');
      } else {
        setError(`Ses tanıma hatası: ${event.error}`);
      }
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      if (isRecording) {
        // Kayıt devam ediyorsa recognition'ı yeniden başlat
        setTimeout(() => {
          if (recognitionRef.current && isRecording) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.log('Recognition restart failed:', err);
            }
          }
        }, 100);
      }
    };
    
    return recognition;
  };

  const getAudioStream = async (): Promise<MediaStream> => {
    try {
      let stream: MediaStream;
      
      switch (audioSource) {
        case 'microphone':
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          break;
          
        case 'system':
          // Sistem sesi için getDisplayMedia kullan ama sadece audio iste
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000,
                channelCount: 2,
                sampleSize: 16
              } as any,
              video: {
                width: 1,
                height: 1,
                frameRate: 1
              }
            });
            
            // Video track'leri durdur ama audio'yu koru
            const videoTracks = stream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
            
            // Sadece audio track'leri ile yeni stream oluştur
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
              // Tüm ekran seçildiğinde audio olmayabilir, kullanıcıya rehberlik et
              setError('Sistem sesi bulunamadı. Lütfen:\n1. Ses çıkışı olan bir SEKME seçin (YouTube, Spotify vb.)\n2. "Sistem sesini paylaş" kutucuğunu işaretleyin\n3. Tüm ekran yerine spesifik sekme/uygulama seçin');
              throw new Error('SYSTEM_AUDIO_NO_TRACK');
            }
            
            stream = new MediaStream(audioTracks);
            
          } catch (displayError: any) {
            console.warn('getDisplayMedia failed:', displayError);

            // Kullanıcı iptal ettiyse veya hata varsa açık mesaj ver
            if (displayError.name === 'NotAllowedError') {
              setError('Ekran paylaşımı iptal edildi. Sistem sesini kaydetmek için:\n1. Ekran paylaşımına izin verin\n2. Ses çıkışı olan SEKME seçin (tüm ekran değil)\n3. "Sistem sesini paylaş" kutucuğunu işaretleyin');
              throw new Error('SYSTEM_AUDIO_CANCELLED');
            } else if (displayError.name === 'NotFoundError') {
              setError('Ses kaynağı bulunamadı. Lütfen:\n1. Ses çıkışı olan bir SEKME seçin (YouTube, Spotify vb.)\n2. Tüm ekran yerine spesifik sekme seçin\n3. "Sistem sesini paylaş" kutucuğunu işaretleyin');
              throw new Error('SYSTEM_AUDIO_NOT_FOUND');
            } else {
              setError(`Sistem sesi yakalanamadı: ${displayError.message}\n\nÇözüm:\n1. Tüm ekran yerine ses çıkışı olan SEKME seçin\n2. "Sistem sesini paylaş" kutucuğunu işaretleyin\n3. YouTube, Spotify gibi ses çıkışı olan uygulamalar tercih edin`);
              throw new Error('SYSTEM_AUDIO_FAILED');
            }
          }
          break;
          
        case 'both':
          const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          
          let systemStream: MediaStream;
          try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000,
                channelCount: 2,
                sampleSize: 16
              } as any,
              video: {
                width: 1,
                height: 1,
                frameRate: 1
              }
            });
            
            // Video track'leri durdur
            const videoTracks = displayStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
            
            // Sadece audio track'leri al
            const audioTracks = displayStream.getAudioTracks();
            if (audioTracks.length === 0) {
              console.warn('Sistem sesinde audio track bulunamadı, sadece mikrofon kullanılacak');
              setError('Sistem sesinde audio bulunamadı, sadece mikrofon kaydediliyor.\n\nTüm ekran yerine ses çıkışı olan SEKME seçin (YouTube, Spotify vb.)');
              return micStream;
            }
            
            systemStream = new MediaStream(audioTracks);
            
          } catch (err: any) {
            console.warn('Sistem sesi alınamadı, sadece mikrofon kullanılacak:', err);
            if (err.name === 'NotAllowedError') {
              setError('Ekran paylaşımı iptal edildi, sadece mikrofon kaydediliyor.\n\nSistem sesi için ses çıkışı olan SEKME seçin (tüm ekran değil)');
            } else {
              setError('Sistem sesi alınamadı, sadece mikrofon kaydediliyor.\n\nTüm ekran yerine ses çıkışı olan SEKME seçin (YouTube, Spotify vb.)');
            }
            return micStream;
          }
          
          // Audio context ile sesleri birleştir
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;

          const destination = audioContext.createMediaStreamDestination();
          const micSource = audioContext.createMediaStreamSource(micStream);
          const systemSource = audioContext.createMediaStreamSource(systemStream);
          const micGain = audioContext.createGain();
          const systemGain = audioContext.createGain();

          micGain.gain.value = 0.9;
          systemGain.gain.value = 1.0;

          micSource.connect(micGain);
          systemSource.connect(systemGain);

          micGain.connect(destination);
          systemGain.connect(destination);

          stream = destination.stream;
          break;
          
        default:
          throw new Error('Geçersiz ses kaynağı seçimi.');
      }
      
      return stream;
    } catch (err: any) {
      console.error('Audio stream error:', err);

      // Hata türüne göre özel mesajlar
      const isSystemAudioHandledError = err instanceof Error && typeof err.message === 'string' && err.message.startsWith('SYSTEM_AUDIO_');

      if (err.name === 'NotAllowedError') {
        setError('Mikrofon/ekran paylaşımı izni verilmedi. Lütfen tarayıcı ayarlarından izinleri etkinleştirin.');
      } else if (err.name === 'NotFoundError') {
        setError('Ses kaynağı bulunamadı. Mikrofon bağlı olduğundan emin olun.');
      } else if (!isSystemAudioHandledError) {
        setError((prev) => prev ?? `Ses kaynağı hatası: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
      }

      throw err;
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      finalDurationRef.current = 0;
      finalTextRef.current = '';
      interimTextRef.current = '';
      setRealtimeText('');
      setTranscript(''); // İkinci kayıt için transcript state'ini temizle

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => null);
        audioContextRef.current = null;
      }
      
      // Get audio stream
      const stream = await getAudioStream();
      streamRef.current = stream;
      
      // Setup MediaRecorder for audio file
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm',
        audioBitsPerSecond: 256000
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('MediaRecorder stopped, calling onRecordingComplete with:', {
          audioBlobSize: audioBlob.size,
          finalTextLength: finalTextRef.current.length
        });
        const durationSeconds = finalDurationRef.current || Math.max(recordingTime, 0);
        onRecordingComplete(audioBlob, finalTextRef.current, durationSeconds);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // 1 saniyede bir chunk
      
      const shouldUseSpeechRecognition = audioSource !== 'system';

      // Setup Speech Recognition for realtime transcription
      if (shouldUseSpeechRecognition) {
        const recognition = setupSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          recognition.start();
        }
      } else {
        recognitionRef.current = null;
        setRealtimeText('');
      }
      
      // Start recording timer
      const startTime = Date.now();
      setRecordingStartTime(startTime);
      recordingStartTimeRef.current = startTime;
      setRecordingTime(0);

      const timer = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);
      }, 1000);

      setRecordingTimer(timer);

      setIsRecording(true);

    } catch (err) {
      console.error('Recording start error:', err);
      // Internal error kodlarını kullanıcıya gösterme
      if (err instanceof Error) {
        if (err.message.startsWith('SYSTEM_AUDIO_')) {
          // Internal error kodları için error zaten set edilmiş, tekrar set etme
          console.log('System audio error already handled:', err.message);
        } else if (!error) {
          // Diğer hatalar için genel mesaj
          setError(`Kayıt başlatılamadı: ${err.message}`);
        }
      }
      setIsRecording(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => null);
        audioContextRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    try {
      // Clear recording timer
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
      const finalDuration = recordingStartTime
        ? Math.max(0, Math.floor((Date.now() - recordingStartTime) / 1000))
        : recordingTime;
      finalDurationRef.current = finalDuration;
      setRecordingTime(finalDuration);
      setRecordingStartTime(null);
      recordingStartTimeRef.current = null;

      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Stop Speech Recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      // Stop audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => null);
        audioContextRef.current = null;
      }

      setIsRecording(false);

    } catch (err: any) {
      console.error('Recording stop error:', err);
      setError(`Kayıt durdurulamadı: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  if (!isSupported) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-red-700">
          <MicOff className="w-5 h-5" />
          <span className="font-medium">Tarayıcı Desteği Yok</span>
        </div>
        <p className="text-red-600 text-sm mt-2">
          Bu tarayıcı ses kaydı ve transkripsiyon özelliklerini desteklemiyor. 
          Chrome, Firefox veya Safari kullanmayı deneyin.
        </p>
      </div>
    );
  }

  const handleAudioSourceChange = (source: AudioSource) => {
    setAudioSource(source);
    if (source === 'microphone') {
      setShowSystemGuide(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Ses Kaydı ve Transkripsiyon</h2>
        </div>

      {/* Audio Source Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Ses Kaynağı Seçin
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleAudioSourceChange('microphone')}
            className={`p-3 rounded-lg border-2 transition-all ${
              audioSource === 'microphone'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            disabled={isRecording}
          >
            <Mic className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs font-medium">Sadece Mikrofon</div>
          </button>
          
          <button
            onClick={() => handleAudioSourceChange('system')}
            className={`p-3 rounded-lg border-2 transition-all ${
              !hasDisplayMediaSupport
                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 
              audioSource === 'system'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            disabled={isRecording || !hasDisplayMediaSupport}
          >
            <Volume2 className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs font-medium">Sistem Sesi</div>
            {!hasDisplayMediaSupport && (
              <div className="text-xs text-gray-400 mt-1">Desteklenmiyor</div>
            )}
          </button>
          
          <button
            onClick={() => handleAudioSourceChange('both')}
            className={`p-3 rounded-lg border-2 transition-all ${
              !hasDisplayMediaSupport
                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 
              audioSource === 'both'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            disabled={isRecording || !hasDisplayMediaSupport}
          >
            <Users className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs font-medium">Her İkisi</div>
            {!hasDisplayMediaSupport && (
              <div className="text-xs text-gray-400 mt-1">Desteklenmiyor</div>
            )}
          </button>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex flex-col items-center space-y-4 mb-6">
        {/* Recording Timer Display */}
        {isRecording && (
          <div className="flex items-center space-x-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-lg font-mono font-semibold text-red-700">
              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </span>
            <span className="text-sm text-red-600">kayıt süresi</span>
          </div>
        )}

        <button
          onClick={toggleRecording}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          disabled={!isSupported}
        >
          {isRecording ? (
            <>
              <Square className="w-5 h-5" />
              <span>Kaydı Durdur</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>Kayıt Başlat</span>
            </>
          )}
        </button>
      </div>

      {/* Realtime Transcription Display */}
      {realtimeText && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Anlık Transkripsiyon</h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {realtimeText}
            </pre>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-red-700">
            <MicOff className="w-5 h-5" />
            <span className="font-medium">Hata</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {showSystemGuide && (
        <div className="mt-4 border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-blue-800">Hoparlör Sesini Kaydetme Adımları</h3>
              <p className="text-xs text-blue-700 mt-1">
                Chrome güvenlik kuralları gereği sistem sesini paylaşmak için aşağıdaki adımları izleyin:
              </p>
            </div>
            <button
              onClick={() => setShowSystemGuide(false)}
              className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
            >
              Gizle
            </button>
          </div>
          <ol className="list-decimal list-inside text-xs text-blue-700 space-y-1">
            <li>Kayıt başlatmadan önce ses çalan sekmeyi veya uygulamayı açık tutun.</li>
            <li>"Kayıt Başlat" dediğinizde Chrome'un paylaşılan ekran penceresinden <strong>"Sekme"</strong> seçeneğini işaretleyin.</li>
            <li>Ses çalan sekmeyi seçip <strong>"Sekme sesi"</strong> (veya "Sistem sesini paylaş") kutucuğunu aktif hale getirin.</li>
            <li>Eğer hem mikrofon hem hoparlör seçtiyseniz, birlikte tek bir kayıtta karışacaktır.</li>
            <li>Paylaşım penceresini kapatırsanız kayıt tamamlanır; tekrar paylaşım yapmak için yeniden "Kayıt Başlat" butonuna tıklayın.</li>
          </ol>
          <p className="text-[11px] text-blue-600">
            Not: Anlık transkripsiyon yalnızca mikrofon girişiyle çalışır. Sistem sesini kaydederken metni sonradan Gemini ile üretebilirsiniz.
          </p>
        </div>
      )}

      {/* Audio Source Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>Seçili Kaynak:</strong> {
            audioSource === 'microphone' ? 'Sadece Mikrofon' :
            audioSource === 'system' ? 'Sistem Sesi (Video, Müzik, Görüntülü Konuşma)' :
            'Mikrofon + Sistem Sesi'
          }
        </div>
        {audioSource === 'system' && (
          <div className="text-xs text-blue-600 mt-1">
            <strong>ÖNEMLİ:</strong> Tüm ekran değil, ses çıkışı olan SEKME seçin (YouTube, Spotify, Zoom vb.) ve "Sistem sesini paylaş" kutucuğunu işaretleyin.
            <br />
            Anlık transkripsiyon bu modda devre dışıdır; kayıt sonrası Gemini'den iyileştirme alabilirsiniz.
          </div>
        )}
        {audioSource === 'both' && (
          <div className="text-xs text-blue-600 mt-1">
            <strong>ÖNEMLİ:</strong> Hem mikrofonunuz hem de sistem sesiniz kaydedilecek. Tüm ekran değil, ses çıkışı olan SEKME seçin ve "Sistem sesini paylaş" kutucuğunu işaretleyin.
          </div>
        )}
      </div>

      {/* Storage Location Info */}
      <div className="mt-4 border border-gray-200 bg-gray-50 rounded-lg p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800">Kayıt Konumu</div>
            <p className="text-xs text-gray-600 mt-1">
              {recordingStorageMode === 'directory'
                ? recordingDirectoryName
                  ? `Yeni kayıtlar "${recordingDirectoryName}" klasörüne kaydediliyor.`
                  : 'Yeni kayıtlar seçtiğiniz klasöre kaydedilecek.'
                : 'Kayıtlar tarayıcının yerel depolamasında saklanıyor.'}
            </p>
            {recordingStorageMode === 'directory' && !hasDirectoryAccess && (
              <p className="text-xs text-red-600 mt-1">
                Tarayıcı klasör erişimini onaylamadı. Lütfen klasörü tekrar seçin.
              </p>
            )}
          </div>
          <button
            onClick={() => {
              void onSelectStorageDirectory();
            }}
            disabled={isRecording || isSelectingStorageDirectory}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRecording || isSelectingStorageDirectory
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            {recordingStorageMode === 'directory' ? 'Klasörü Değiştir' : 'Klasör Seç'}
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-800">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-blue-900">Yalnızca sizin kontrolünüzde</p>
            <p>
              Seçtiğiniz klasör sadece bu cihazda saklanır; uygulama geliştiricileri dahil kimse bu dosyalara erişemez.
            </p>
            <p>
              Tarayıcı güvenlik kuralları nedeniyle sayfayı yenilediğinizde klasör erişimini yeniden onaylamanız gerekebilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
