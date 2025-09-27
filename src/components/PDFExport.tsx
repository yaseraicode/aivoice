import React from 'react';
import { AIImprovement } from './TranscriptionPanel';
import { FileDown, FileText, Sparkles, GitCompare } from 'lucide-react';
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

  interface SpeechInsights {
    durationLabel: string;
    wordCount: number;
    wpmLabel: string;
    toneLabel: string;
  }

  const formatDurationDetailed = (seconds: number | undefined): string => {
    if (!seconds || seconds <= 0) {
      return 'Bilgi yok';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const minuteLabel = minutes > 0 ? `${minutes} dk` : '';
    const secondLabel = `${remainingSeconds} sn`;
    return [minuteLabel, secondLabel].filter(Boolean).join(' ');
  };

  const calculateSpeechInsights = (text: string, durationSeconds?: number): SpeechInsights => {
    const sanitized = text
      .replace(/👤\s*Konuşmacı\s*\d+\s*\[[^\]]*\]:?/gi, '')
      .replace(/📋\s*BAŞLIK:?/gi, '')
      .replace(/[•-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const tokens = sanitized ? sanitized.split(' ') : [];
    const wordCount = tokens.filter(Boolean).length;

    const effectiveDuration = durationSeconds && durationSeconds > 0 ? durationSeconds : undefined;
    const minutes = effectiveDuration ? effectiveDuration / 60 : undefined;
    const wordsPerMinute = minutes ? Math.round(wordCount / minutes) : null;

    let paceLabel = 'Bilgi yok';
    if (wordsPerMinute !== null && Number.isFinite(wordsPerMinute)) {
      if (wordsPerMinute < 100) paceLabel = `${wordsPerMinute} kelime/dk (Yavaş)`;
      else if (wordsPerMinute <= 150) paceLabel = `${wordsPerMinute} kelime/dk (Doğal)`;
      else paceLabel = `${wordsPerMinute} kelime/dk (Hızlı)`;
    }

    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    const uppercaseWords = (text.match(/\b[\p{Lu}]{4,}\b/gu) || []).length;

    const positiveWords = ['teşekkür', 'mutlu', 'harika', 'iyi', 'memnun'];
    const negativeWords = ['sorun', 'problem', 'endişe', 'gergin', 'korku', 'hata'];
    const fillerWords = ['hani', 'şey', 'yani', 'eee', 'aslında'];

    const positiveCount = positiveWords.reduce((acc, word) => acc + (sanitized.includes(word) ? 1 : 0), 0);
    const negativeCount = negativeWords.reduce((acc, word) => acc + (sanitized.includes(word) ? 1 : 0), 0);
    const fillerCount = fillerWords.reduce((acc, word) => acc + (sanitized.split(word).length - 1), 0);

    const toneTags: string[] = [];
    if (negativeCount > positiveCount) toneTags.push('Gergin');
    if (exclamationCount >= 3 || uppercaseWords >= 2) toneTags.push('Heyecanlı');
    if (questionCount >= 3) toneTags.push('Meraklı');
    if (fillerCount > Math.max(1, wordCount * 0.05)) toneTags.push('Düşünceli');

    if (toneTags.length === 0) {
      toneTags.push('Dengeli');
    }

    return {
      durationLabel: formatDurationDetailed(durationSeconds),
      wordCount,
      wpmLabel: paceLabel,
      toneLabel: toneTags.join(', ')
    };
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

  type PdfBlock =
    | { type: 'heading'; title: string; detail?: string }
    | { type: 'speaker'; speaker: string; time?: string; content: string }
    | { type: 'bullet'; content: string }
    | { type: 'paragraph'; content: string };

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
          if (timeRaw) parts.push(`[${timeRaw}]`);
          if (content) parts.push(content);
          if (parts.length > 0) {
            result.push(`  • ${parts.join(' ')}`);
          }
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
        result.push(`  • [${timeSegment}]${content ? ` ${content}` : ''}`);
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

  const parseTranscriptionBlocks = (text: string): PdfBlock[] => {
    if (!text) return [];

    const normalized = compressConsecutiveSpeakers(text.replace(/\r\n/g, '\n'));
    const blocks: PdfBlock[] = [];
    normalized.split('\n').forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        blocks.push({ type: 'paragraph', content: '' });
        return;
      }

      if (/^bu\s+transkripsiyon\s+metni/i.test(line)) {
        return;
      }

      const speakerPattern = /^\*{0,2}(Kon[uşu]mac[ıi]|Konusmaci)\s*(\d+)\*{0,2}\s*(?:\[([^\]]*)\])?\s*:\s*(.*)$/i;
      const speakerMatch = line.match(speakerPattern);
      if (speakerMatch) {
        const speakerNumber = speakerMatch[2];
        const timeRaw = speakerMatch[3]?.trim();
        const contentRaw = speakerMatch[4]?.trim() ?? '';
        blocks.push({
          type: 'speaker',
          speaker: `Konuşmacı ${speakerNumber}`,
          time: timeRaw ? stripMarkdownTokens(timeRaw) : undefined,
          content: stripMarkdownTokens(contentRaw)
        });
        return;
      }

      if (line.startsWith('👤')) {
        const match = line.match(/^👤\s*(.*?)\s*(?:\[([^\]]*)\])?\s*:\s*(.*)$/);
        const speakerRaw = match?.[1] ?? 'Konuşmacı';
        const timeRaw = match?.[2]?.trim();
        const contentRaw = match?.[3]?.trim() ?? '';
        blocks.push({
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
          blocks.push({ type: 'bullet', content: bulletText });
        }
        return;
      }

      const looseHeading = line.match(/^\*{2,}\s*(.+?)(?:\s*\*{2,})?$/);
      if (looseHeading) {
        const headingText = stripMarkdownTokens(looseHeading[1]);
        if (headingText) {
          blocks.push({ type: 'heading', title: headingText });
        }
        return;
      }

      const markdownHeadingMatch = line.match(/^#{1,3}\s*(.*)$/);
      if (markdownHeadingMatch) {
        const title = stripMarkdownTokens(markdownHeadingMatch[1]);
        if (title) {
          blocks.push({ type: 'heading', title });
        }
        return;
      }

      if (line.startsWith('📋')) {
        const cleaned = line.replace(/^📋\s*/, '').trim();
        const [descriptor, ...rest] = cleaned.split(':');
        const title = stripMarkdownTokens(rest.length > 0 ? rest.join(':') : descriptor);
        const rawDetail = rest.length > 0 ? descriptor.trim() : undefined;
        const detail = rawDetail && rawDetail.toLowerCase() !== 'başlık'
          ? stripMarkdownTokens(rawDetail)
          : undefined;
        blocks.push({ type: 'heading', title, detail });
        return;
      }

      const fallbackSpeakerMatch = line.match(/^((?:Kon[uşu]mac[ıi]|Konusmaci)\s*\d+)\s*\[([^\]]*)\]\s*:\s*(.*)$/i);
      if (fallbackSpeakerMatch) {
        const [, speakerLabel, timeRaw, contentRaw] = fallbackSpeakerMatch;
        blocks.push({
          type: 'speaker',
          speaker: stripMarkdownTokens(speakerLabel).replace(/Konusmaci|Konusmacı|Konuşmaci/gi, 'Konuşmacı'),
          time: timeRaw.trim() ? stripMarkdownTokens(timeRaw) : undefined,
          content: stripMarkdownTokens(contentRaw.trim())
        });
        return;
      }

      blocks.push({ type: 'paragraph', content: stripMarkdownTokens(line) });
    });

    return blocks;
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
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);

      // Başlık
      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);

      let title = '';
      switch (type) {
        case 'raw':
          title = 'SES KAYDI · HAM TRANSKRIPSIYON';
          break;
        case 'ai':
          title = 'SES KAYDI · AI IYILESTIRMESI';
          break;
        case 'comparison':
          title = 'SES KAYDI · KARSILASTIRMA';
          break;
      }

      const titleWidth = doc.getTextWidth(title);
      const titleX = (pageWidth - titleWidth) / 2;
      doc.text(title, titleX, 22);

      const insights = calculateSpeechInsights(transcript || aiImprovementData?.original || '', recordingInfo?.duration);

      const summaryEntries = [
        { label: 'Ses Kayit Süresi', value: insights.durationLabel },
        { label: 'Konuşma Hızı', value: insights.wpmLabel },
        { label: 'Ses Analizi', value: insights.toneLabel }
      ];

      const secondaryEntries = [
        recordingInfo ? `Kayit Tarihi: ${recordingInfo.startTime.toLocaleDateString('tr-TR')} ${recordingInfo.startTime.toLocaleTimeString('tr-TR')}` : null,
        `Kelime Sayisi: ${insights.wordCount}`,
        `PDF Olusturma: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`
      ].filter(Boolean) as string[];

      const summaryHeight = 26 + secondaryEntries.length * 4.5;
      doc.setDrawColor(205, 220, 255);
      doc.setFillColor(243, 246, 255);
      doc.roundedRect(margin, 26, maxWidth, summaryHeight, 3, 3, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(60, 80, 120);

      let infoY = 34;
      summaryEntries.forEach(({ label, value }) => {
        const cleanLabel = convertTurkishCharacters(`${label}:`);
        const cleanValue = convertTurkishCharacters(value);
        doc.setFont('helvetica', 'bold');
        doc.text(cleanLabel, margin + 4, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanValue, margin + 48, infoY);
        infoY += 5;
      });

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      secondaryEntries.forEach((entry) => {
        const cleanEntry = convertTurkishCharacters(entry);
        doc.text(cleanEntry, margin + 4, infoY);
        infoY += 4.5;
      });

      const currentY = 26 + summaryHeight + 12;

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
        generateStandardPDF(doc, transcript, 'HAM TRANSKRIPSIYON', currentY, margin, maxWidth);
        doc.save(`voicescript-ham-${Date.now()}.pdf`);
      } else if (type === 'ai' && aiImprovementData) {
        generateStandardPDF(doc, aiImprovementData.improved, 'AI IYILESTIRILMIS TRANSKRIPSIYON', currentY, margin, maxWidth);
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
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(convertTurkishCharacters(title), margin, startY);

    if (!content || !content.trim()) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Henuz transkripsiyon metni bulunmuyor.', margin, startY + 15);
      return;
    }

    const blocks = parseTranscriptionBlocks(content);
    let yPosition = startY + 12;
    const pageHeight = doc.internal.pageSize.height;
    const lineHeight = 5;

    const ensureSpace = (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
    };

    blocks.forEach((block) => {
      switch (block.type) {
        case 'heading': {
          ensureSpace(9);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(45, 64, 110);
          const heading = convertTurkishCharacters(block.title.toUpperCase());
          doc.text(heading, margin, yPosition);
          if (block.detail) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(120, 130, 150);
            doc.text(convertTurkishCharacters(block.detail), margin, yPosition + 4);
            yPosition += 9;
          } else {
            yPosition += 7;
          }
          break;
        }
        case 'speaker': {
          const headerHeight = block.time ? 7 : 6;
          ensureSpace(headerHeight + 6);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(40, 80, 140);
          const label = convertTurkishCharacters(block.speaker + (block.time ? ` [${block.time}]` : ''));
          doc.text(label, margin, yPosition);
          yPosition += 5;

          if (block.content) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(33, 33, 33);
            const wrapped = doc.splitTextToSize(convertTurkishCharacters(block.content), maxWidth - 6);
            wrapped.forEach((line: string) => {
              ensureSpace(lineHeight);
              doc.text(line, margin + 6, yPosition);
              yPosition += lineHeight;
            });
          }
          yPosition += 2;
          break;
        }
        case 'bullet': {
          ensureSpace(lineHeight + 2);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          const bulletLines = doc.splitTextToSize(convertTurkishCharacters(block.content), maxWidth - 10);
          bulletLines.forEach((line: string, index: number) => {
            ensureSpace(lineHeight);
            if (index === 0) {
              doc.text('•', margin + 2, yPosition);
              doc.text(line, margin + 7, yPosition);
            } else {
              doc.text(line, margin + 7, yPosition);
            }
            yPosition += lineHeight;
          });
          yPosition += 1;
          break;
        }
        case 'paragraph': {
          if (!block.content) {
            yPosition += 3;
            break;
          }
          const paragraphLines = doc.splitTextToSize(convertTurkishCharacters(block.content), maxWidth);
          paragraphLines.forEach((line: string) => {
            ensureSpace(lineHeight);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
            doc.text(line, margin, yPosition);
            yPosition += lineHeight;
          });
          yPosition += 3;
          break;
        }
        default:
          break;
      }
    });
  };

  const renderComparisonPreviewBox = (
    doc: jsPDF,
    text: string,
    title: string,
    x: number,
    y: number,
    width: number,
    pageHeight: number,
    margin: number
  ): number => {
    const boxHeight = 70;
    if (y + boxHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(220, 228, 255);
    doc.setFillColor(250, 252, 255);
    doc.roundedRect(x, y, width, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 70, 130);
    doc.text(convertTurkishCharacters(title), x + 4, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    const contentBlocks = parseTranscriptionBlocks(text);
    const previewLines: string[] = [];
    contentBlocks.forEach((block) => {
      if (previewLines.length >= 20) {
        return;
      }
      if (block.type === 'heading' && block.title) {
        previewLines.push(`■ ${block.title}`);
      } else if (block.type === 'speaker') {
        const speakerLabel = block.speaker;
        const content = block.content ? ` ${block.content}` : '';
        const time = block.time ? ` [${block.time}]` : '';
        previewLines.push(`${speakerLabel}${time}:${content}`.trim());
      } else if (block.type === 'bullet') {
        previewLines.push(`• ${block.content}`);
      } else if (block.type === 'paragraph' && block.content) {
        previewLines.push(block.content);
      }
    });

    const availableWidth = width - 8;
    let textY = y + 14;
    previewLines.slice(0, 20).forEach((line) => {
      const wrapped = doc.splitTextToSize(convertTurkishCharacters(line), availableWidth);
      wrapped.forEach((wrappedLine: string) => {
        if (textY > y + boxHeight - 6) {
          return;
        }
        doc.text(wrappedLine, x + 4, textY);
        textY += 4;
      });
      if (textY > y + boxHeight - 6) {
        doc.text('...', x + width - 12, y + boxHeight - 6);
        return;
      }
    });

    return y + boxHeight + 8;
  };

  const generateComparisonPDF = (
    doc: jsPDF,
    rawText: string,
    aiData: AIImprovement,
    startY: number,
    margin: number,
    maxWidth: number
  ) => {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(15);
    doc.setTextColor(30, 30, 30);
    const title = 'KARSILASTIRMALI TRANSKRIPSIYON OZETI';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, startY);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const comparisonInfo = [
      `Iyilestirme Turu: ${getImprovementTypeText(aiData.improvementType)}`,
      `Islem Tarihi: ${aiData.timestamp.toLocaleDateString('tr-TR')} ${aiData.timestamp.toLocaleTimeString('tr-TR')}`,
      `Ham Metin: ${rawText.length} karakter`,
      `AI Metni: ${aiData.improved.length} karakter`
    ];

    let yPos = startY + 12;
    comparisonInfo.forEach((info) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(convertTurkishCharacters(info), margin, yPos);
      yPos += 5;
    });

    const columnWidth = (maxWidth - 8) / 2;
    const columnGutter = 8;
    const previewStartY = yPos + 4;
    const nextLeft = renderComparisonPreviewBox(
      doc,
      rawText,
      'Ham Transkripsiyon (Önizleme)',
      margin,
      previewStartY,
      columnWidth,
      pageHeight,
      margin
    );
    const nextRight = renderComparisonPreviewBox(
      doc,
      aiData.improved,
      'AI İyileştirilmiş (Önizleme)',
      margin + columnWidth + columnGutter,
      previewStartY,
      columnWidth,
      pageHeight,
      margin
    );

    const postPreviewY = Math.max(nextLeft, nextRight);
    if (postPreviewY > pageHeight - margin) {
      doc.addPage();
    } else {
      doc.setDrawColor(225, 230, 245);
      doc.line(margin, postPreviewY, pageWidth - margin, postPreviewY);
      doc.addPage();
    }

    generateStandardPDF(doc, rawText, 'HAM TRANSKRIPSIYON', margin, margin, maxWidth);
    doc.addPage();
    generateStandardPDF(doc, aiData.improved, 'AI IYILESTIRILMIS TRANSKRIPSIYON', margin, margin, maxWidth);
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
