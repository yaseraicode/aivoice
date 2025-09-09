import React from 'react';
import { AIImprovement } from './TranscriptionPanel';
import { FileDown, FileText, Sparkles, GitCompare, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';

interface PDFExportProps {
  transcript: string;
  aiImprovementData: AIImprovement | null;
  recordingInfo?: {
    duration: number;
    quality: string;
    startTime: Date;
  };
}

const PDFExport: React.FC<PDFExportProps> = ({
  transcript,
  aiImprovementData,
  recordingInfo
}) => {

  // Türkçe karakter mapping tablosu
  const turkishCharacterMap: { [key: string]: string } = {
    'ş': 's',
    'Ş': 'S',
    'ğ': 'g',
    'Ğ': 'G',
    'ü': 'u',
    'Ü': 'U',
    'ö': 'o',
    'Ö': 'O',
    'ç': 'c',
    'Ç': 'C',
    'ı': 'i',
    'İ': 'I'
  };

  // Türkçe karakterleri PDF-safe karakterlere dönüştür
  const convertTurkishCharacters = (text: string): string => {
    if (!text) return '';
    
    let converted = text;
    
    // Türkçe karakterleri ASCII karşılıklarıyla değiştir
    Object.entries(turkishCharacterMap).forEach(([turkish, ascii]) => {
      const regex = new RegExp(turkish, 'g');
      converted = converted.replace(regex, ascii);
    });
    
    // Diğer problematik karakterleri temizle
    converted = converted
      .replace(/[^\x20-\x7E\s]/g, '') // Sadece ASCII karakterler ve boşluk
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    
    return converted;
  };

  // Alternatif: Türkçe karakterleri koruyarak encoding düzelt
  const fixTurkishEncoding = (text: string): string => {
    if (!text) return '';
    
    // UTF-8 encoding problemlerini düzelt
    return text
      .replace(/Ã§/g, 'ç')
      .replace(/Ã‡/g, 'Ç')
      .replace(/ÄŸ/g, 'ğ')
      .replace(/Ä/g, 'Ğ')
      .replace(/Å/g, 'ş')
      .replace(/Åž/g, 'Ş')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ãœ/g, 'Ü')
      .replace(/Ã¶/g, 'ö')
      .replace(/Ã–/g, 'Ö')
      .replace(/Ä±/g, 'ı')
      .replace(/Ä°/g, 'İ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  };

  const generatePDF = async (type: 'raw' | 'ai' | 'comparison') => {
    try {
      console.log('PDF oluşturma başlatıldı:', type);

      // jsPDF kontrolü
      if (!jsPDF) {
        throw new Error('jsPDF kütüphanesi yüklenemedi');
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      console.log('jsPDF instance oluşturuldu');

      // Font ayarları - Türkçe karakter desteği için
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // PDF metadata
      doc.setProperties({
        title: `VoiceScript Pro - ${type === 'raw' ? 'Ham Transkripsiyon' : type === 'ai' ? 'AI Iyilestirilmis' : 'Karsilastirmali'}`,
        subject: 'Ses Kayit Transkripsiyon',
        author: 'VoiceScript Pro',
        creator: 'VoiceScript Pro v1.0'
      });

      // Sayfa ayarları
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);

      // Başlık
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);

      let title = "";
      switch (type) {
        case 'raw':
          title = "SES KAYDI - HAM TRANSKRIPSIYON";
          break;
        case 'ai':
          title = "SES KAYDI - AI IYILESTIRILMIS";
          break;
        case 'comparison':
          title = "SES KAYDI - KARSILASTIRMALI GORUNUM";
          break;
      }

      // Başlığı ortala
      const titleWidth = doc.getTextWidth(title);
      const titleX = (pageWidth - titleWidth) / 2;
      doc.text(title, titleX, 25);

      // Kayıt bilgileri
      if (recordingInfo) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);

        const formatDuration = (seconds: number) => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const info = [
          `Kayit Tarihi: ${recordingInfo.startTime.toLocaleDateString('tr-TR')} ${recordingInfo.startTime.toLocaleTimeString('tr-TR')}`,
          `Sure: ${formatDuration(recordingInfo.duration)}`,
          `Kalite: ${recordingInfo.quality}`,
          `Olusturulma: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`
        ];

        let yPos = 35;
        info.forEach(line => {
          // Türkçe karakterleri ASCII'ye çevir
          const cleanLine = convertTurkishCharacters(line);
          doc.text(cleanLine, margin, yPos);
          yPos += 4;
        });
      }

      let currentY = recordingInfo ? 60 : 40;

      // İçerik kontrolü
      if (!transcript && type === 'raw') {
        throw new Error('Transkripsiyon metni bulunamadı');
      }

      if (type === 'ai' && !aiImprovementData) {
        throw new Error('AI iyileştirme verisi bulunamadı');
      }

      if (type === 'comparison' && !aiImprovementData) {
        throw new Error('Karşılaştırma için AI iyileştirme verisi gerekli');
      }

      // İçerik oluştur
      if (type === 'raw') {
        generateStandardPDF(doc, transcript, "HAM TRANSKRIPSIYON", currentY, margin, maxWidth);
        doc.save(`voicescript-ham-${Date.now()}.pdf`);
      } else if (type === 'ai' && aiImprovementData) {
        generateStandardPDF(doc, aiImprovementData.improved, "AI IYILESTIRILMIS TRANSKRIPSIYON", currentY, margin, maxWidth);
        doc.save(`voicescript-ai-${Date.now()}.pdf`);
      } else if (type === 'comparison' && aiImprovementData) {
        generateComparisonPDF(doc, transcript, aiImprovementData, currentY, margin, maxWidth);
        doc.save(`voicescript-karsilastirmali-${Date.now()}.pdf`);
      }

      console.log('PDF başarıyla oluşturuldu');

    } catch (error) {
      console.error('PDF olusturma hatasi:', error);

      // Kullanıcı dostu hata mesajı
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      alert(`PDF oluşturulamadı: ${errorMessage}\n\nLütfen sayfayı yenileyip tekrar deneyin.`);

      // Hata detaylarını console'a yaz
      if (error instanceof Error) {
        console.error('Hata detayı:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
    }
  };

  const generateStandardPDF = (
    doc: jsPDF, 
    content: string, 
    title: string, 
    startY: number, 
    margin: number, 
    maxWidth: number
  ) => {
    // Bölüm başlığı
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    const cleanTitle = convertTurkishCharacters(title);
    doc.text(cleanTitle, margin, startY);
    
    if (!content || !content.trim()) {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("Henuz transkripsiyon metni bulunmuyor.", margin, startY + 15);
      return;
    }
    
    let yPosition = startY + 15;
    const lineHeight = 5;
    const pageHeight = doc.internal.pageSize.height;
    
    // İçeriği temizle ve Türkçe karakterleri düzelt
    const processedContent = convertTurkishCharacters(content);
    const lines = processedContent.split('\n');
    
    lines.forEach((line) => {
      // Yeni sayfa kontrolü
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      
      if (line.trim()) {
        // Font stilini içerik tipine göre ayarla
        if (line.includes('BASLIK:') || line.includes('BAŞLIK:')) {
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
        } else if (line.includes('Kisi') && line.includes('[')) {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
        } else {
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
        }
        
        // Uzun satırları böl
        try {
          const wrappedLines = doc.splitTextToSize(line, maxWidth);
          
          if (Array.isArray(wrappedLines)) {
            wrappedLines.forEach((wrappedLine: string) => {
              if (yPosition > pageHeight - 30) {
                doc.addPage();
                yPosition = 20;
              }
              doc.text(wrappedLine, margin, yPosition);
              yPosition += lineHeight;
            });
          } else {
            doc.text(wrappedLines, margin, yPosition);
            yPosition += lineHeight;
          }
        } catch (textError) {
          console.warn('Text rendering error:', textError);
          // Fallback: basit metin render
          const safeLine = line.substring(0, 100);
          doc.text(safeLine, margin, yPosition);
          yPosition += lineHeight;
        }
      } else {
        yPosition += 3; // Boş satır
      }
    });
  };

  const generateComparisonPDF = (
    doc: jsPDF, 
    rawText: string, 
    aiData: any, 
    startY: number, 
    margin: number, 
    maxWidth: number
  ) => {
    const pageHeight = doc.internal.pageSize.height;
    
    // Başlık sayfası
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    const pageWidth = doc.internal.pageSize.width;
    const titleText = "KARSILASTIRMALI GORUNUM";
    const titleWidth = doc.getTextWidth(titleText);
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(titleText, titleX, startY);
    
    // Özet bilgileri
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    
    const summaryInfo = [
      `Iyilestirme Turu: ${getImprovementTypeText(aiData.improvementType)}`,
      `Islem Tarihi: ${aiData.timestamp.toLocaleDateString('tr-TR')} ${aiData.timestamp.toLocaleTimeString('tr-TR')}`,
      `Ham Metin Uzunlugu: ${rawText.length} karakter`,
      `Iyilestirilmis Metin Uzunlugu: ${aiData.improved.length} karakter`
    ];
    
    let yPos = startY + 15;
    summaryInfo.forEach(info => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
      // Türkçe karakterleri düzelt
      const cleanInfo = convertTurkishCharacters(info);
      doc.text(cleanInfo, margin, yPos);
      yPos += 5;
    });
    
    // Sayfa 2: Ham transkripsiyon
    doc.addPage();
    generateStandardPDF(doc, rawText, "HAM TRANSKRIPSIYON", 20, margin, maxWidth);
    
    // Sayfa 3: AI iyileştirilmiş
    doc.addPage();
    generateStandardPDF(doc, aiData.improved, "AI IYILESTIRILMIS TRANSKRIPSIYON", 20, margin, maxWidth);
  };

  const getImprovementTypeText = (type: string): string => {
    switch (type) {
      case 'fast': return 'Hizli Duzeltme';
      case 'detailed': return 'Detayli Iyilestirme';
      case 'summary': return 'Ozet Cikarma';
      default: return 'Bilinmiyor';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <FileDown className="w-6 h-6 text-blue-600" />
        PDF Export
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Raw PDF Export */}
        <button
          onClick={() => generatePDF('raw')}
          disabled={!transcript}
          className="flex flex-col items-center gap-3 p-6 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <FileText className="w-8 h-8 text-gray-600 group-hover:text-blue-600 transition-colors" />
          <div className="text-center">
            <h3 className="font-semibold text-gray-800">Ham Transkripsiyon</h3>
            <p className="text-sm text-gray-600">Düzenlenmemiş kayıt metni</p>
          </div>
        </button>

        {/* AI Improved PDF Export */}
        <button
          onClick={() => generatePDF('ai')}
          disabled={!aiImprovementData}
          className="flex flex-col items-center gap-3 p-6 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <Sparkles className="w-8 h-8 text-gray-600 group-hover:text-blue-600 transition-colors" />
          <div className="text-center">
            <h3 className="font-semibold text-gray-800">AI İyileştirilmiş</h3>
            <p className="text-sm text-gray-600">Yapay zeka ile düzenlenmiş</p>
          </div>
        </button>

        {/* Comparison PDF Export */}
        <button
          onClick={() => generatePDF('comparison')}
          disabled={!aiImprovementData}
          className="flex flex-col items-center gap-3 p-6 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <GitCompare className="w-8 h-8 text-gray-600 group-hover:text-blue-600 transition-colors" />
          <div className="text-center">
            <h3 className="font-semibold text-gray-800">Karşılaştırmalı</h3>
            <p className="text-sm text-gray-600">Her iki versiyon birlikte</p>
          </div>
        </button>
      </div>

      {!transcript && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-center">PDF oluşturmak için önce kayıt yapın</p>
        </div>
      )}

      {transcript && !aiImprovementData && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-800 text-center text-sm">
            💡 AI iyileştirme yaparak daha fazla PDF seçeneğine erişin
          </p>
        </div>
      )}
    </div>
  );
};

export default PDFExport;
