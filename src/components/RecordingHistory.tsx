import React, { useState, useEffect } from 'react';
import { History, FileText, Trash2, Download, Search, Calendar } from 'lucide-react';

interface Recording {
  id: string;
  title: string;
  rawTranscript: string;
  geminiTranscript?: string;
  aiImproved?: string;
  aiImprovedTranscript?: string;
  duration: number;
  quality: string;
  timestamp: Date;
  speakerCount: number;
  audioData?: string;
  audioType?: string;
}

interface RecordingHistoryProps {
  recordings: Recording[];
  onLoadRecording: (recording: Recording) => void;
  activeRecordingId: string | null;
  onDeleteRecording: (id: string) => void;
  onUpdateRecording: (id: string, updates: Partial<Recording>) => void;
}

const RecordingHistory: React.FC<RecordingHistoryProps> = ({ 
  recordings, 
  onLoadRecording, 
  activeRecordingId,
  onDeleteRecording,
  onUpdateRecording 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [isExpanded, setIsExpanded] = useState(true); // Başlangıçta açık olsun
  
  // Recordings'i timestamp'e göre sırala (en yeni önce)
  const sortedRecordings = [...recordings].sort((a, b) => {
    const dateA = typeof a.timestamp === 'string' ? new Date(a.timestamp) : a.timestamp;
    const dateB = typeof b.timestamp === 'string' ? new Date(b.timestamp) : b.timestamp;
    return dateB.getTime() - dateA.getTime();
  });

  // Debug: recordings prop'unu logla
  useEffect(() => {
    console.log('RecordingHistory - recordings prop:', recordings);
    console.log('RecordingHistory - localStorage check:', localStorage.getItem('voicescript-recordings'));
  }, [recordings]);

  const updateRecordingTitle = (id: string, newTitle: string) => {
    onUpdateRecording(id, { title: newTitle });
  };

  const filteredRecordings = sortedRecordings.filter(recording => {
    const matchesSearch = recording.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (recording.rawTranscript || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (recording.geminiTranscript || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const recordingDate = typeof recording.timestamp === 'string' 
      ? new Date(recording.timestamp) 
      : recording.timestamp;
    
    const matchesDate = !filterDate || 
                       recordingDate.toISOString().split('T')[0] === filterDate;
    
    return matchesSearch && matchesDate;
  });

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTruncatedContent = (content: string, maxLength: number = 100): string => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
      <div 
        className="flex items-center justify-between p-6 border-b border-gray-200 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600" />
          Kayıt Geçmişi ({recordings.length})
        </h2>
        <div className="flex items-center gap-2">
          {recordings.length > 0 && (
            <span className="text-sm text-gray-500">
              Son: {new Date(recordings[0]?.timestamp).toLocaleDateString('tr-TR')}
            </span>
          )}
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Kayıtlarda ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Recordings List */}
          {filteredRecordings.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {recordings.length === 0 ? 'Henüz kayıt yapılmamış - İlk kaydınızı yapın!' : 'Arama kriterlerine uygun kayıt bulunamadı'}
              </p>
              {recordings.length === 0 && (
                <p className="text-gray-400 text-sm mt-2">
                  Kayıt yapmak için "Kayıt Başlat" butonuna basın
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecordings.map((recording) => (
                <div
                  key={recording.id}
                  className={`border rounded-lg p-4 transition-colors cursor-pointer ${'border-gray-200 hover:bg-gray-50'}`}
                  onClick={() => {
                    console.log('Kayıt tıklandı:', recording.id);
                    onLoadRecording(recording);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={recording.title}
                        onChange={(e) => updateRecordingTitle(recording.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-lg font-semibold text-gray-800 bg-transparent border-none outline-none focus:bg-white focus:border focus:border-blue-500 focus:rounded px-2 py-1 w-full"
                      />
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(recording.timestamp).toLocaleDateString('tr-TR')} {new Date(recording.timestamp).toLocaleTimeString('tr-TR')}
                        </span>
                        <span>Süre: {formatDuration(recording.duration)}</span>
                        <span>👥 {recording.speakerCount} kişi</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadRecording(recording);
                        }}
                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Yükle
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecording(recording.id);
                        }}
                        className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Sil
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {getTruncatedContent(recording.rawTranscript || recording.geminiTranscript || 'Transkripsiyon mevcut değil')}
                  </p>

                  {recording.rawTranscript && typeof recording.rawTranscript === 'string' && recording.rawTranscript.trim() !== '' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      Ham transkripsiyon mevcut
                    </div>
                  )}

                  {((recording.aiImproved && typeof recording.aiImproved === 'string' && recording.aiImproved.trim() !== '') ||
                    (recording.aiImprovedTranscript && typeof recording.aiImprovedTranscript === 'string' && recording.aiImprovedTranscript.trim() !== '')) && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      AI iyileştirmesi mevcut
                    </div>
                  )}
                  
                  {recording.geminiTranscript && typeof recording.geminiTranscript === 'string' && recording.geminiTranscript.trim() !== '' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-purple-600">
                      <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                      Gemini transkripsiyon mevcut
                    </div>
                  )}
                  
                  {recording.audioData && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      Ses dosyası mevcut ({(recording.audioData.length / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecordingHistory;
