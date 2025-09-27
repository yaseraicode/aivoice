import React, { useState, useEffect, useRef } from 'react';
import { FileText, Sparkles, GitCompare, Copy, Download, RefreshCw, Play, Pause, Volume2, UserCircle, Edit3, Eye } from 'lucide-react';
import { GeminiKeyManager } from '../services/GeminiKeyManager';

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-preview-09-2025';

export interface AIImprovement {
  original: string;
  improved: string;
  improvementType: 'fast' | 'detailed' | 'summary';
  timestamp: Date;
  error?: string;
}

interface TranscriptionPanelProps {
  transcript: string;
  setTranscript: (text: string) => void;
  aiImprovement: AIImprovement | null;
  setAiImprovement: (improvement: AIImprovement | null) => void;
  geminiTranscription: string;
  setGeminiTranscription: (text: string) => void;
  recordedAudio: Blob | null;
  isRecording: boolean;
  currentRecordingId: string | null;
  onSaveRecording?: () => void;
  onUpdateRecording?: (id: string, updates: any) => void;
  recordingDuration?: number;
}

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  transcript,
  setTranscript,
  aiImprovement,
  setAiImprovement,
  geminiTranscription,
  setGeminiTranscription,
  recordedAudio,
  isRecording,
  currentRecordingId,
  onSaveRecording,
  onUpdateRecording,
  recordingDuration
}) => {
  const [activeTab, setActiveTab] = useState<'realtime' | 'gemini' | 'ai' | 'comparison'>('realtime');
  const [isImproving, setIsImproving] = useState(false);
  const [improvementType, setImprovementType] = useState<'fast' | 'detailed' | 'summary'>('detailed');
  const [isGeminiTranscribing, setIsGeminiTranscribing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAiEditMode, setIsAiEditMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const latestDurationRef = useRef(0);
  
  const realtimeTextRef = useRef<HTMLTextAreaElement>(null);
  const aiTextRef = useRef<HTMLTextAreaElement>(null);
  const geminiTextRef = useRef<HTMLTextAreaElement>(null);

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
    };
  }, []);

  // Keep latest duration in a ref for event handlers
  useEffect(() => {
    const candidate = audioDuration > 0 ? audioDuration : (recordingDuration ?? 0);
    latestDurationRef.current = candidate;
  }, [audioDuration, recordingDuration]);

  useEffect(() => {
    if (aiImprovement) {
      setIsAiEditMode(false);
    }
  }, [aiImprovement?.timestamp]);

  // Preload metadata when audio blob changes for accurate duration display
  useEffect(() => {
    if (!recordedAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      setIsPlayingAudio(false);
      setAudioDuration(recordingDuration ?? 0);
      setCurrentTime(0);
      setAudioProgress(0);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    setIsPlayingAudio(false);

    setAudioProgress(0);
    setCurrentTime(0);

    const fallbackDuration = recordingDuration ?? 0;
    if (fallbackDuration > 0) {
      setAudioDuration(fallbackDuration);
    } else {
      setAudioDuration(0);
    }

    const metadataUrl = URL.createObjectURL(recordedAudio);
    const probe = document.createElement('audio');
    probe.preload = 'metadata';

    const handleLoadedMetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setAudioDuration(probe.duration);
      }
      URL.revokeObjectURL(metadataUrl);
    };

    const handleError = () => {
      if (fallbackDuration > 0) {
        setAudioDuration(fallbackDuration);
      }
      URL.revokeObjectURL(metadataUrl);
    };

    probe.addEventListener('loadedmetadata', handleLoadedMetadata);
    probe.addEventListener('error', handleError);
    probe.src = metadataUrl;
    probe.load();

    return () => {
      probe.removeEventListener('loadedmetadata', handleLoadedMetadata);
      probe.removeEventListener('error', handleError);
      URL.revokeObjectURL(metadataUrl);
    };
  }, [recordedAudio, recordingDuration]);

  // Audio playback functions with progress tracking
  const playRecordedAudio = () => {
    if (recordedAudio && !isPlayingAudio) {
      // Clean up previous audio if exists
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }

      const audioUrl = URL.createObjectURL(recordedAudio);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      currentAudioUrlRef.current = audioUrl;

      // Set up event listeners for progress tracking
      audio.onloadedmetadata = () => {
        const metaDuration = Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : latestDurationRef.current;
        if (metaDuration > 0) {
          setAudioDuration(metaDuration);
          latestDurationRef.current = metaDuration;
        }
        setCurrentTime(0);
        setAudioProgress(0);
      };

      audio.onloadeddata = () => {
        console.log('Audio data loaded');
      };

      audio.oncanplay = () => {
        console.log('Audio can play');
      };

      audio.ontimeupdate = () => {
        const durationCandidate = Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : latestDurationRef.current;

        const safeDuration = durationCandidate > 0 ? durationCandidate : 0;
        const time = audio.currentTime;

        setCurrentTime(time);

        if (safeDuration > 0) {
          const progress = Math.min(100, (time / safeDuration) * 100);
          setAudioProgress(progress);
        }
      };

      audio.onplay = () => {
        console.log('Audio started playing');
        setIsPlayingAudio(true);
      };

      audio.onpause = () => {
        console.log('Audio paused');
        setIsPlayingAudio(false);
      };

      audio.onended = () => {
        console.log('Audio ended');
        setIsPlayingAudio(false);
        const safeDuration = latestDurationRef.current;
        if (safeDuration > 0) {
          setCurrentTime(safeDuration);
          setAudioProgress(100);
        } else {
          setCurrentTime(0);
          setAudioProgress(0);
        }
        // Don't revoke URL here as we might want to replay
      };

      audio.onerror = (err) => {
        console.error('Audio error:', err);
        setIsPlayingAudio(false);
      };

      // Start playing
      audio.play().catch(err => {
        console.error('Audio playback error:', err);
        setIsPlayingAudio(false);
      });
    }
  };

  const pauseRecordedAudio = () => {
    if (audioRef.current && isPlayingAudio) {
      audioRef.current.pause();
    }
  };

  const toggleAudioPlayback = () => {
    if (isPlayingAudio) {
      pauseRecordedAudio();
    } else {
      playRecordedAudio();
    }
  };

  // Seek to specific time in audio
  const seekAudio = (event: React.MouseEvent<HTMLDivElement>) => {
    const audioElement = audioRef.current;
    const duration = latestDurationRef.current > 0 ? latestDurationRef.current : audioDuration;
    if (!audioElement || duration <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = Math.min(duration, Math.max(0, percentage * duration));

    audioElement.currentTime = newTime;
    setCurrentTime(newTime);
    setAudioProgress(Math.min(100, percentage * 100));
  };

  // Format time display
  const formatTime = (time: number): string => {
    if (isNaN(time) || !isFinite(time)) {
      return '0:00';
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Count speakers from Gemini transcription
  const countSpeakersFromTranscription = (transcription: string): number => {
    const normalizedText = transcription || '';
    const modernMatches = [...normalizedText.matchAll(/Konuşmacı\s*(\d+)/gi)]
      .map(match => match[1]);

    if (modernMatches.length > 0) {
      return Math.max(new Set(modernMatches).size, 1);
    }

    const legacyMatches = [...normalizedText.matchAll(/([A-Z])\s*Kişisi/gi)]
      .map(match => match[1].toUpperCase());

    if (legacyMatches.length > 0) {
      return Math.max(new Set(legacyMatches).size, 1);
    }

    return 1;
  };

  // Gemini API Integration - Audio Transcription with Key Rotation
  const transcribeWithGemini = async (audioBlob: Blob, retryCount = 0) => {
    const keyManager = GeminiKeyManager.getInstance();
    const currentKey = keyManager.getCurrentKey();

    if (!currentKey) {
      console.warn('No valid Gemini API keys found, using demo transcription');
      const demoTranscription = `📋 BAŞLIK: Gemini Ses Transkripsiyon Demo

👤 Konuşmacı 1 [${new Date().toLocaleTimeString('tr-TR')}]: Bu bir Gemini API ile ses transkripsiyon demo metnidir. Ayarlar sayfasından API anahtarı ekleyerek gerçek transkripsiyon özelliğini kullanabilirsiniz.

👤 Konuşmacı 2 [${new Date().toLocaleTimeString('tr-TR')}]: Ses dosyası boyutu: ${(audioBlob.size / 1024).toFixed(2)} KB. Demo modunda çalışılıyor.

📋 BAŞLIK: Kurulum Gerekli

Sistem: Gemini API anahtarı bulunamadı. Lütfen Ayarlar sayfasından geçerli bir API anahtarı ekleyin.`;

      setGeminiTranscription(normalizeGeminiTimestamps(demoTranscription));
      setActiveTab('gemini');
      return;
    }

    const GEMINI_API_KEY = currentKey.key;

    // Log which key is being used
    console.log(`🔑 Using Gemini API key: ${currentKey.name} (ID: ${currentKey.id})`);

    try {
      setIsGeminiTranscribing(true);
      
      // Convert audio blob to base64
      const base64Audio = await blobToBase64(audioBlob);
      
      const model = GEMINI_DEFAULT_MODEL;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      console.log('Gemini Audio Transcription Request:', {
        model,
        audioSize: audioBlob.size,
        audioType: audioBlob.type
      });
      
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `Bu ses kaydını Türkçe olarak yazıya dök. Konuşmacıları ayır ve her satırı şu formatta yaz:

👤 Konuşmacı 1 [dakika:saniye]: metin
👤 Konuşmacı 2 [dakika:saniye]: metin

Zaman bilgisini kaydın gerçek başlangıç anına göre hesapla (örneğin konuşma 4. saniyede başlıyorsa [00:04] yaz). Varsayılan konuşmacı adlarını "Konuşmacı 1", "Konuşmacı 2" şeklinde sırayla kullan. Başlıkları 📋 BAŞLIK: formatında göster. Noktalama işaretlerini ekle ve düzgün paragraflar oluştur.`
              },
              {
                inline_data: {
                  mime_type: audioBlob.type || 'audio/webm',
                  data: base64Audio
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          topK: 40,
          topP: 0.95,
        }
      };
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Gemini Audio API Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini Audio API Error:', errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gemini Audio API Response:', data);
      
      const transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!transcribedText) {
        throw new Error('Gemini\'den transkripsiyon alınamadı');
      }

      const normalizedTranscription = normalizeGeminiTimestamps(transcribedText);
      setGeminiTranscription(normalizedTranscription);
      setActiveTab('gemini');

      // Count speakers from transcription and update recording
      const detectedSpeakerCount = countSpeakersFromTranscription(normalizedTranscription);
      console.log(`🎤 Detected ${detectedSpeakerCount} speakers in Gemini transcription`);

      // Update recording with correct speaker count
      if (onUpdateRecording) {
        // Update the current recording if we have an ID, otherwise update the most recent
        onUpdateRecording(currentRecordingId || '', {
          geminiTranscript: normalizedTranscription,
          speakerCount: detectedSpeakerCount
        });
      }

      // Mark key as used and rotate to next key for round-robin
      keyManager.markKeyAsUsed(currentKey.id);
      keyManager.rotateKey();

      console.log(`✅ Successfully used key: ${currentKey.name}, rotated to next key`);

      // Gemini transkripsiyon tamamlandığında - mevcut kaydı güncelle
      // onSaveRecording çağrısı kaldırıldı çünkü yeni kayıt oluşturuyor
      
    } catch (error) {
      console.error('Gemini ses transkripsiyon hatası:', error);
      
      // Fallback to demo transcription
      const demoTranscription = `📋 BAŞLIK: Gemini Transkripsiyon (Demo - Hata)

👤 Konuşmacı 1 [${new Date().toLocaleTimeString('tr-TR')}]: Gemini API ile ses transkripsiyon sırasında hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}

👤 Konuşmacı 2 [${new Date().toLocaleTimeString('tr-TR')}]: Demo transkripsiyon gösteriliyor. Gerçek API anahtarı ve model ayarlarını kontrol edin.

📋 BAŞLIK: Teknik Bilgiler

Sistem: Ses dosyası boyutu ${(audioBlob.size / 1024).toFixed(2)} KB, format: ${audioBlob.type}`;
      
      const normalizedFallback = normalizeGeminiTimestamps(demoTranscription);
      setGeminiTranscription(normalizedFallback);
      setActiveTab('gemini');
      
      // Demo transkripsiyon için de mevcut kaydı güncelle
      if (onUpdateRecording) {
        onUpdateRecording(currentRecordingId || '', {
          geminiTranscript: normalizedFallback,
          speakerCount: 1
        });
      }
    } finally {
      setIsGeminiTranscribing(false);
    }
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const compressConsecutiveSpeakers = (text: string): string => {
    const lines = text.split('\n');
    const result: string[] = [];
    let lastSpeaker: string | null = null;

    lines.forEach((originalLine) => {
      const trimmed = originalLine.trim();

      if (!trimmed) {
        result.push('');
        lastSpeaker = null;
        return;
      }

      const speakerMatch = trimmed.match(/^(?:👤\s*)?Konuşmacı\s*(\d+)(?:\s*\[([^\]]*)\])?:\s*(.*)$/i);
      if (speakerMatch) {
        const speakerId = speakerMatch[1];
        const timeRaw = speakerMatch[2]?.trim();
        const content = speakerMatch[3].trim();

        if (lastSpeaker === speakerId) {
          const parts = [];
          if (timeRaw) {
            parts.push(`[${timeRaw}]`);
          }
          if (content) {
            parts.push(content);
          }
          const bulletLine = parts.length > 0 ? `  • ${parts.join(' ')}` : '';
          result.push(bulletLine);
        } else {
          lastSpeaker = speakerId;
          const timeSegment = timeRaw ? ` [${timeRaw}]` : '';
          const prefix = `👤 Konuşmacı ${speakerId}${timeSegment}:`;
          const line = content ? `${prefix} ${content}` : prefix;
          result.push(line.trim());
        }
        return;
      }

      if (/^📋/.test(trimmed) || /^#{1,3}\s/.test(trimmed)) {
        lastSpeaker = null;
      }

      const continuationMatch = trimmed.match(/^\[(\d{1,2}:\d{2})\]\s*(.*)$/);
      if (continuationMatch && lastSpeaker) {
        const timeSegment = continuationMatch[1];
        const content = continuationMatch[2].trim();
        const bulletLine = `  • [${timeSegment}]${content ? ` ${content}` : ''}`;
        result.push(bulletLine);
        return;
      }

      result.push(originalLine);
    });

    return result
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*•\s*$/gm, '')
      .trimEnd();
  };

  const normalizeGeminiTimestamps = (text: string): string => {
    if (!text) {
      return text;
    }

    const withNormalizedTimes = text.replace(/\[(\d{1,2})\.(\d{2})\]/g, (_match, minutes: string, seconds: string) => {
      const safeMinutes = minutes.padStart(2, '0');
      const safeSeconds = seconds.padStart(2, '0');
      return `[${safeMinutes}:${safeSeconds}]`;
    });

    return compressConsecutiveSpeakers(withNormalizedTimes);
  };

  // Gemini API Integration - Text Improvement with Key Rotation
  const improveWithAI = async (rawTranscription: string, type: 'fast' | 'detailed' | 'summary', retryCount = 0) => {
    const keyManager = GeminiKeyManager.getInstance();
    const currentKey = keyManager.getCurrentKey();

    if (!currentKey) {
      console.warn('No valid Gemini API keys found, using demo improvement');
      const demoImprovement = simulateAIImprovement(rawTranscription, type);
      const improvement: AIImprovement = {
        original: rawTranscription,
        improved: demoImprovement,
        improvementType: type,
        timestamp: new Date(),
        error: 'Gemini API anahtarı bulunamadı. Lütfen Ayarlar sayfasından geçerli bir API anahtarı ekleyin.'
      };
      setAiImprovement(improvement);
      setActiveTab('ai');
      return;
    }

    const GEMINI_API_KEY = currentKey.key;

    // Log which key is being used for AI improvement
    console.log(`🔑 Using Gemini API key for AI improvement: ${currentKey.name} (ID: ${currentKey.id})`);

    const prompts = {
      fast: `Bu Türkçe transkripsiyon metnini düzgün paragraflar halinde düzenle ve bariz yazım hatalarını düzelt. Noktalama işaretlerini ekle. Orijinal anlamı koru:

${rawTranscription}`,
      
      detailed: `Bu Türkçe toplantı transkripsiyon metnini profesyonel bir dokümana çevir. Şunları yap:
1. Başlıkları net hiyerarşiye koy (📋 BAŞLIK: formatını koru)
2. Konuşmacı geçişlerini düzenle (👤 Konuşmacı 1, 👤 Konuşmacı 2 formatını koru)
3. Tekrarları temizle
4. Dilbilgisi hatalarını düzelt
5. Paragraf yapısını iyileştir
6. Noktalama işaretlerini düzelt

Metin:
${rawTranscription}`,
      
      summary: `Bu Türkçe transkripsiyon metninden ana konuları ve önemli noktaları özetleyerek yapılandırılmış bir özet çıkar. Başlık formatını (📋) ve konuşmacı etiketlerini (👤 Konuşmacı N) koru:

${rawTranscription}`
    };

    try {
      setIsImproving(true);
      
      const model = GEMINI_DEFAULT_MODEL;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      console.log('Gemini API Request:', {
        model,
        apiUrl: apiUrl.replace(GEMINI_API_KEY, '[HIDDEN]'),
        promptLength: prompts[type].length
      });
      
      const requestBody = {
        contents: [
          {
            parts: [{ text: prompts[type] }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topK: 40,
          topP: 0.95,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Gemini API Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error Response:', errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gemini API Response Data:', data);
      
      const improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!improvedText) {
        console.error('No text in Gemini response:', data);
        throw new Error('Gemini\'den metin alınamadı. Yanıt yapısı beklenenden farklı.');
      }

      const cleanedImprovement = normalizeGeminiTimestamps(improvedText);

      const improvement: AIImprovement = {
        original: rawTranscription,
        improved: cleanedImprovement,
        improvementType: type,
        timestamp: new Date()
      };

      setAiImprovement(improvement);
      setActiveTab('ai');

      // Update recording with AI improvement
      if (onUpdateRecording) {
        onUpdateRecording(currentRecordingId || '', {
          aiImprovedTranscript: cleanedImprovement,
          processedTranscript: cleanedImprovement
        });
      }

      // Mark key as used and rotate to next key for round-robin
      keyManager.markKeyAsUsed(currentKey.id);
      keyManager.rotateKey();

      console.log(`✅ Successfully used key for AI improvement: ${currentKey.name}, rotated to next key`);
      
    } catch (error) {
      console.error('AI iyileştirme hatası:', error);
      
      // Fallback to demo improvement
      const demoImprovement = simulateAIImprovement(rawTranscription, type);
      const errorImprovement: AIImprovement = {
        original: rawTranscription,
        improved: demoImprovement,
        improvementType: type,
        timestamp: new Date(),
        error: `Gemini API hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Demo iyileştirme gösteriliyor.`
      };
      setAiImprovement(errorImprovement);
      setActiveTab('ai');
    } finally {
      setIsImproving(false);
    }
  };

  // Demo AI improvement simulation
  const simulateAIImprovement = (text: string, type: 'fast' | 'detailed' | 'summary', index?: number): string => {
    if (!text.trim()) return text;

    let improved = text;

    switch (type) {
      case 'fast':
        // Simple cleanup
        improved = text
          .replace(/\s+/g, ' ')
          .replace(/([.!?])\s*([a-zçğıöşü])/gi, '$1 $2')
          .replace(/([a-zçğıöşü])\s*([A-ZÇĞIÖŞÜ])/g, '$1. $2')
          .trim();
        break;

      case 'detailed':
        // More comprehensive formatting
        improved = formatDetailedTranscription(text);
        break;

      case 'summary':
        // Create a summary
        improved = createSummary(text);
        break;
    }

    return normalizeGeminiTimestamps(improved);
  };

  const formatDetailedTranscription = (text: string): string => {
    let formatted = text;

    // Clean up and structure
    formatted = formatted
      .replace(/\s+/g, ' ')
      .trim();

    // Convert legacy speaker labels (A Kişisi) to the modern format
    formatted = formatted.replace(/([A-Z])\s*Kişisi\s*\[([^\]]+)\]:\s*/gi, (_match: string, letter: string, time: string) => {
      const speakerIndex = letter.toUpperCase().charCodeAt(0) - 64;
      const label = Number.isFinite(speakerIndex) && speakerIndex > 0
        ? `Konuşmacı ${speakerIndex}`
        : `Konuşmacı ${letter.toUpperCase()}`;
      return `👤 ${label} [${time}]: `;
    });

    // Normalize speaker label spacing and ensure icon usage
    formatted = formatted.replace(/👤\s*Konuşmacı\s*(\d+)\s*\[([^\]]+)\]:\s*/gi, '\n\n👤 Konuşmacı $1 [$2]: ');
    formatted = formatted.replace(/(^|\n)\s*Konuşmacı\s*(\d+)\s*\[([^\]]+)\]:\s*/gi, '\n\n👤 Konuşmacı $2 [$3]: ');

    // Improve speaker sections
    const sections = formatted.split(/(?=👤)/);
    formatted = sections
      .map((section, index) => {
        if (index === 0 && !section.includes('👤')) {
          return section.trim();
        }
        
        const cleaned = section.trim();
        if (cleaned.startsWith('👤')) {
          // Add proper spacing and punctuation
          return '\n\n' + cleaned.replace(/([a-zçğıöşü])\s+([A-ZÇĞIÖŞÜ])/g, '$1. $2');
        }
        return cleaned;
      })
      .join('');

    // Improve title formatting
    formatted = formatted.replace(/📋\s*(BAŞLIK|başlık|Başlık):\s*/gi, '\n\n📋 BAŞLIK: ');
    
    // Add proper punctuation
    formatted = formatted.replace(/([a-zçğıöşü])\s+([A-ZÇĞIÖŞÜ])/g, '$1. $2');
    
    // Clean up extra spaces and newlines
    formatted = formatted
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    return formatted;
  };

  const createSummary = (text: string): string => {
    const lines = text.split('\n').filter(line => line.trim());
    const summary = [];

    summary.push('📋 BAŞLIK: Konuşma Özeti\n');
    
    // Extract main points
    const speakers = lines.filter(line => /Konuşmacı\s*\d+/i.test(line) || /[A-Z]\s*Kişisi/i.test(line));
    const titles = lines.filter(line => line.includes('📋'));
    
    if (titles.length > 0) {
      summary.push('## Ana Konular:');
      titles.forEach(title => {
        const cleanTitle = title.replace(/📋\s*(BAŞLIK|başlık|Başlık):\s*/gi, '');
        summary.push(`• ${cleanTitle.trim()}`);
      });
      summary.push('');
    }

    if (speakers.length > 0) {
      summary.push('## Katılımcı Görüşleri:');
      speakers.slice(0, 3).forEach(speaker => {
        const cleanSpeaker = speaker
          .replace(/👤\s*Konuşmacı\s*\d+\s*\[.*?\]:\s*/i, '')
          .replace(/[A-Z]\s*Kişisi\s*\[.*?\]:\s*/i, '')
          .substring(0, 100) + '...';
        summary.push(`• ${cleanSpeaker}`);
      });
    }

    summary.push('\n## Özet Bilgiler:');
    const speakerIds = speakers.map(s => {
      const modernMatch = s.match(/Konuşmacı\s*(\d+)/i)?.[1];
      if (modernMatch) {
        return modernMatch;
      }
      const legacyMatch = s.match(/([A-Z])\s*Kişisi/i)?.[1];
      return legacyMatch || 'Bilinmiyor';
    });
    summary.push(`• Toplam konuşmacı: ${new Set(speakerIds).size}`);
    summary.push(`• Metin uzunluğu: ${text.length} karakter`);
    summary.push(`• Oluşturulma: ${new Date().toLocaleString('tr-TR')}`);

    return summary.join('\n');
  };

  const stripMarkdownTokens = (value: string): string => {
    if (!value) {
      return '';
    }
    return value
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  type AiPreviewNode =
    | { type: 'heading'; title: string; detail?: string }
    | { type: 'bullet'; items: string[] }
    | { type: 'speaker'; speaker: string; time?: string; content: string }
    | { type: 'paragraph'; content: string };

  const renderAiImprovedPreview = (text: string) => {
    const sanitizedText = compressConsecutiveSpeakers(text)
      .replace(/\r\n/g, '\n')
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1');

    const lines = sanitizedText.split('\n');
    const nodes: AiPreviewNode[] = [];
    let bulletBuffer: string[] = [];

    const flushBullets = () => {
      if (bulletBuffer.length > 0) {
        nodes.push({ type: 'bullet', items: [...bulletBuffer] });
        bulletBuffer = [];
      }
    };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        flushBullets();
        return;
      }

      if (/^[-_*]{3,}$/.test(line.replace(/\s+/g, ''))) {
        flushBullets();
        return;
      }

      if (/^bu\s+transkripsiyon\s+metni/i.test(line)) {
        flushBullets();
        return;
      }

      const speakerPattern = /^\*{0,2}(Kon[uşu]mac[ıi]|Konusmaci)\s*(\d+)\*{0,2}\s*(?:\[([^\]]*)\])?\s*:\s*(.*)$/i;
      const speakerMatch = line.match(speakerPattern);
      if (speakerMatch) {
        flushBullets();
        const speakerNumber = speakerMatch[2];
        const timeRaw = speakerMatch[3]?.trim();
        const contentRaw = speakerMatch[4]?.trim() ?? '';
        nodes.push({
          type: 'speaker',
          speaker: `Konuşmacı ${speakerNumber}`,
          time: timeRaw ? stripMarkdownTokens(timeRaw) : undefined,
          content: stripMarkdownTokens(contentRaw)
        });
        return;
      }

      if (line.startsWith('👤')) {
        flushBullets();
        const match = line.match(/^👤\s*(.*?)\s*(?:\[([^\]]*)\])?\s*:\s*(.*)$/);
        const speakerRaw = match?.[1] ?? 'Konuşmacı';
        const timeRaw = match?.[2]?.trim();
        const contentRaw = match?.[3]?.trim() ?? '';
        nodes.push({
          type: 'speaker',
          speaker: stripMarkdownTokens(speakerRaw).replace(/Konusmaci|Konusmacı|Konuşmaci/gi, 'Konuşmacı'),
          time: timeRaw ? stripMarkdownTokens(timeRaw) : undefined,
          content: stripMarkdownTokens(contentRaw)
        });
        return;
      }

      if (/^[-•]\s+/.test(line)) {
        const bulletText = stripMarkdownTokens(line.replace(/^[-•]\s*/, ''));
        if (bulletText) {
          bulletBuffer.push(bulletText);
        }
        return;
      }

      const looseHeading = line.match(/^\*{2,}\s*(.+?)(?:\s*\*{2,})?$/);
      if (looseHeading) {
        flushBullets();
        const headingText = stripMarkdownTokens(looseHeading[1]);
        if (headingText) {
          nodes.push({ type: 'heading', title: headingText });
        }
        return;
      }

      flushBullets();

      const markdownHeadingMatch = line.match(/^#{1,3}\s*(.*)$/);
      if (markdownHeadingMatch) {
        const title = stripMarkdownTokens(markdownHeadingMatch[1]);
        if (title) {
          nodes.push({ type: 'heading', title });
        }
        return;
      }

      if (line.startsWith('📋')) {
        const cleaned = line.replace(/^📋\s*/, '').trim();
        const [rawTitle, ...rest] = cleaned.split(':');
        const title = stripMarkdownTokens(rest.length > 0 ? rest.join(':') : rawTitle);
        const descriptorRaw = rest.length > 0 ? rawTitle.trim() : undefined;
        const descriptor = descriptorRaw && descriptorRaw.toLowerCase() !== 'başlık'
          ? stripMarkdownTokens(descriptorRaw)
          : undefined;
        nodes.push({ type: 'heading', title, detail: descriptor });
        return;
      }

      const fallbackSpeakerMatch = line.match(/^((?:Kon[uşu]mac[ıi]|Konusmaci)\s*\d+)\s*\[([^\]]*)\]\s*:\s*(.*)$/i);
      if (fallbackSpeakerMatch) {
        const [, label, timeRaw, contentRaw] = fallbackSpeakerMatch;
        nodes.push({
          type: 'speaker',
          speaker: stripMarkdownTokens(label).replace(/Konusmaci|Konusmacı|Konuşmaci/gi, 'Konuşmacı'),
          time: timeRaw.trim() ? stripMarkdownTokens(timeRaw) : undefined,
          content: stripMarkdownTokens(contentRaw.trim())
        });
        return;
      }

      nodes.push({ type: 'paragraph', content: stripMarkdownTokens(line) });
    });

    flushBullets();

    if (nodes.length === 0) {
      return (
        <p className="text-sm text-gray-500">AI iyileştirmesi henüz boş görünüyor.</p>
      );
    }

    return (
      <div className="space-y-3">
        {nodes.map((node, index) => {
          if (node.type === 'heading') {
            return (
              <div
                key={`ai-heading-${index}`}
                className="rounded-xl border-l-4 border-blue-500 bg-white/90 p-4 shadow-sm"
              >
                {node.detail && node.detail.trim().toLowerCase() !== 'başlık' && (
                  <div className="text-xs uppercase tracking-wider text-blue-500 font-semibold mb-1">
                    {node.detail}
                  </div>
                )}
                <div className="text-base font-semibold text-gray-800">
                  {node.title}
                </div>
              </div>
            );
          }

          if (node.type === 'bullet') {
            return (
              <div
                key={`ai-bullets-${index}`}
                className="rounded-xl border border-blue-100 bg-blue-50 p-4"
              >
                <ul className="space-y-2">
                  {node.items.map((item, itemIndex) => (
                    <li key={`ai-bullets-${index}-${itemIndex}`} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="mt-1 text-blue-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

          if (node.type === 'speaker') {
            return (
              <div
                key={`ai-speaker-${index}`}
                className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                    <UserCircle className="w-4 h-4" />
                    <span>{node.speaker}</span>
                  </div>
                  {node.time && (
                    <span className="text-xs font-medium text-gray-400">{node.time}</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {node.content}
                </p>
              </div>
            );
          }

          return (
            <div
              key={`ai-paragraph-${index}`}
              className="rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm"
            >
              <p className="text-sm text-gray-700 leading-relaxed">{node.content}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadAsText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleTabChange = (tab: 'realtime' | 'gemini' | 'ai' | 'comparison') => {
    setActiveTab(tab);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          Transkripsiyon
        </h2>
        
        <div className="flex items-center gap-3">
          {/* Modern Gemini Button - Compact Design */}
          {recordedAudio && !isRecording && (
            <button
              onClick={() => transcribeWithGemini(recordedAudio)}
              disabled={isGeminiTranscribing}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-3 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isGeminiTranscribing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {isGeminiTranscribing ? 'İşleniyor...' : 'Gemini'}
              </span>
            </button>
          )}

          {/* AI Text Improvement Button */}
          {(transcript || geminiTranscription) && !isRecording && (
            <button
              onClick={() => improveWithAI(geminiTranscription || transcript, improvementType)}
              disabled={isImproving}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isImproving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {isImproving ? 'İyileştiriliyor...' : 'AI'}
              </span>
            </button>
          )}

          <select
            value={improvementType}
            onChange={(e) => setImprovementType(e.target.value as 'fast' | 'detailed' | 'summary')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
          >
            <option value="fast">Hızlı</option>
            <option value="detailed">Detaylı</option>
            <option value="summary">Özet</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => handleTabChange('realtime')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'realtime'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Anlık Transkripsiyon
        </button>
        
        {recordedAudio && (
          <button
            onClick={() => handleTabChange('gemini')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'gemini'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Gemini Transkripsiyon
          </button>
        )}
        
        {aiImprovement && (
          <button
            onClick={() => handleTabChange('ai')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'ai'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI İyileştirilmiş
          </button>
        )}
        
        {aiImprovement && (
          <button
            onClick={() => handleTabChange('comparison')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'comparison'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            Karşılaştır
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Modern Audio Player - Better Positioned */}
        {recordedAudio && !isRecording && (
          <div className="mb-6 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-green-600" />
                Ses Kaydı Oynatıcı
              </h3>
              <span className="text-xs text-gray-500">
                {(recordedAudio.size / 1024).toFixed(1)} KB
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Play/Pause Button */}
              <button
                onClick={toggleAudioPlayback}
                className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {isPlayingAudio ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>

              {/* Progress Bar */}
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm font-medium text-gray-700 min-w-[40px]">
                  {formatTime(currentTime)}
                </span>

                <div
                  className="flex-1 h-3 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
                  onClick={seekAudio}
                >
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${audioProgress}%` }}
                  ></div>
                  <div
                    className="absolute top-1/2 transform -translate-y-1/2 w-5 h-5 bg-white border-2 border-green-500 rounded-full shadow-md transition-all duration-300"
                    style={{ left: `calc(${audioProgress}% - 10px)` }}
                  ></div>
                </div>

                <span className="text-sm font-medium text-gray-700 min-w-[40px]">
                  {formatTime(latestDurationRef.current > 0 ? latestDurationRef.current : audioDuration)}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'realtime' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Anlık Transkripsiyon {isRecording ? '(Aktif)' : '(Durduruldu)'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => copyToClipboard(transcript)}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Copy className="w-4 h-4" />
                Kopyala
              </button>
              <button
                onClick={() => downloadAsText(transcript, `transkripsiyon-anlik-${Date.now()}.txt`)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                TXT İndir
              </button>
            </div>
            
            <textarea
              ref={realtimeTextRef}
              value={transcript}
              readOnly
              placeholder={
                isRecording 
                  ? "Konuşmaya başladığınızda metin burada görünecek..." 
                  : "Anlık transkripsiyon için kayıt başlatın"
              }
              className="w-full h-96 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed bg-blue-50"
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        )}

        {activeTab === 'gemini' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Gemini ile Kesin Transkripsiyon</span>
              </div>
              {recordedAudio && (
                <span className="text-sm text-gray-600">
                  Ses dosyası: {(recordedAudio.size / 1024).toFixed(2)} KB
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => copyToClipboard(geminiTranscription)}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Copy className="w-4 h-4" />
                Kopyala
              </button>
              <button
                onClick={() => downloadAsText(geminiTranscription, `transkripsiyon-gemini-${Date.now()}.txt`)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                TXT İndir
              </button>
            </div>
            
            <textarea
              ref={geminiTextRef}
              value={geminiTranscription}
              onChange={(e) => setGeminiTranscription(e.target.value)}
              placeholder="Gemini ile transkripsiyon yapmak için 'Gemini ile Transkribe Et' butonuna basın"
              className="w-full h-96 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm leading-relaxed bg-purple-50"
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        )}

        {activeTab === 'ai' && aiImprovement && (
          <div className="space-y-4">
            {aiImprovement.error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 text-sm">{aiImprovement.error}</p>
              </div>
            )}
            
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">
                İyileştirme Türü: <span className="font-medium">{
                  aiImprovement.improvementType === 'fast' ? 'Hızlı' : 
                  aiImprovement.improvementType === 'detailed' ? 'Detaylı' : 'Özet'
                }</span>
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600">
                {aiImprovement.timestamp.toLocaleString('tr-TR')}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                onClick={() => copyToClipboard(aiImprovement.improved)}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Copy className="w-4 h-4" />
                Kopyala
              </button>
              <button
                onClick={() => downloadAsText(aiImprovement.improved, `transkripsiyon-ai-${Date.now()}.txt`)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                TXT İndir
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setIsAiEditMode((prev) => !prev)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border ${
                  isAiEditMode
                    ? 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50'
                    : 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isAiEditMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                <span>{isAiEditMode ? 'Önizleme' : 'Düzenle'}</span>
              </button>
            </div>
            
            {isAiEditMode ? (
              <textarea
                ref={aiTextRef}
                value={aiImprovement.improved}
                onChange={(e) => setAiImprovement({ ...aiImprovement, improved: e.target.value })}
                className="w-full h-96 p-4 border border-blue-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed bg-blue-50"
                style={{ whiteSpace: 'pre-wrap' }}
              />
            ) : (
              <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6 shadow-inner">
                {renderAiImprovedPreview(aiImprovement.improved)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'comparison' && aiImprovement && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Gemini Transkripsiyon
              </h3>
              <textarea
                value={geminiTranscription || aiImprovement.original}
                readOnly
                className="w-full h-80 p-4 border border-gray-300 rounded-lg resize-none text-sm leading-relaxed bg-purple-50"
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI İyileştirilmiş
              </h3>
              <textarea
                value={aiImprovement.improved}
                readOnly
                className="w-full h-80 p-4 border border-gray-300 rounded-lg resize-none text-sm leading-relaxed bg-blue-50"
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
          </div>
        )}

        {!transcript && !geminiTranscription && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              Hibrit transkripsiyon sistemi için ses kaydı başlatın
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Anlık transkripsiyon + Gemini ile kesin transkripsiyon
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionPanel;
