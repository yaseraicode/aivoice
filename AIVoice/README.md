# VoiceScript Pro - AI Destekli Ses Kayıt ve Transkripsiyon

Modern, kullanıcı dostu ses kayıt ve transkripsiyon uygulaması. Google Gemini AI entegrasyonu ile profesyonel metin iyileştirme özellikleri.

## 🎯 Özellikler

### 🎤 Gelişmiş Ses Kaydı
- Gerçek zamanlı ses kaydı (başlat/durdur/durakla)
- Ses seviyesi görselleştiricisi
- Mikrofon seçimi ve kalite ayarları
- Gürültü engelleme ve ses optimizasyonu

### 📝 Akıllı Transkripsiyon
- Web Speech Recognition API ile canlı transkripsiyon
- Otomatik konuşmacı algılama (👤 Kişi A, Kişi B...)
- Başlık ve yapı tanıma (📋 BAŞLIK formatı)
- Zaman damgalı metin segmentleri

### 🤖 AI Destekli İyileştirme
- Google Gemini AI entegrasyonu
- 3 farklı iyileştirme modu:
  - **Hızlı**: Temel yazım ve dilbilgisi düzeltmeleri
  - **Detaylı**: Kapsamlı yapısal düzenlemeler
  - **Özet**: Ana konuları özetleyen format
- Önce/sonra karşılaştırma görünümü
- Manuel düzenleme imkânı

### 📄 Profesyonel PDF Export
- 3 farklı PDF formatı:
  - Ham transkripsiyon
  - AI iyileştirilmiş versiyon
  - Karşılaştırmalı görünüm
- Türkçe karakter desteği
- Otomatik sayfa düzeni ve formatlaması
- Kayıt bilgileri ve meta data

### 📚 Kayıt Yönetimi
- Otomatik kayıt geçmişi
- Arama ve filtreleme
- Başlık düzenleme
- LocalStorage ile veri saklama

## 🚀 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Production build
npm run build
```

## ⚙️ Konfigürasyon

`.env` dosyası oluşturun:

```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
REACT_APP_GEMINI_MODEL=gemini-pro
REACT_APP_API_RATE_LIMIT=60
```

## 📋 Sistem Gereksinimleri

- Modern web tarayıcısı (Chrome, Firefox, Safari, Edge)
- Mikrofon erişimi
- İnternet bağlantısı (AI özellikleri için)
- JavaScript etkin

## 🔧 Teknoloji Stack'i

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **PDF**: jsPDF
- **AI**: Google Gemini API
- **Audio**: Web Audio API, MediaRecorder API
- **Speech**: Web Speech Recognition API

## 📱 Responsive Tasarım

- **Mobil**: Dokunmatik optimizasyonlu arayüz
- **Tablet**: Hibrit layout çözümleri  
- **Desktop**: Full-featured deneyim

## 🔒 Güvenlik ve Gizlilik

- Ses verileri sadece local işlenir
- API anahtarları güvenli saklanır
- Kullanıcı izinleri kontrollü yönetilir
- Oturum sonunda geçici veriler temizlenir

## 🎨 Kullanıcı Deneyimi

- Apple-level tasarım estetiği
- Micro-interactions ve smooth animasyonlar
- Accessibility standartları
- Intuitive navigation

## 📖 Kullanım Kılavuzu

### Temel Kullanım
1. "Kayıt Başlat" butonuna tıklayın
2. Mikrofon izni verin
3. Konuşun - metin otomatik görünür
4. "Durdur" ile kayıt sonlandırın
5. İstediğiniz PDF formatını seçip indirin

### AI İyileştirme
1. Kayıt tamamlandıktan sonra "AI ile İyileştir"
2. İyileştirme türünü seçin (Hızlı/Detaylı/Özet)
3. "Karşılaştır" sekmesinde değişiklikleri gözden geçirin
4. İstediğiniz versiyonu PDF olarak kaydedin

## 🐛 Bilinen Sınırlamalar

- Web Speech Recognition sadece online çalışır
- Safari'de mikrofon izinleri farklı davranabilir
- AI iyileştirme API limitlerine tabidir
- Çok uzun kayıtlarda performans düşebilir

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun
3. Değişikliklerinizi commit edin
4. Pull request gönderin

## 📄 Lisans

MIT License - Detaylar için LICENSE dosyasına bakın.

## 📞 Destek

Sorularınız için GitHub Issues kullanın veya doğrudan iletişime geçin.

---

**VoiceScript Pro** - Profesyonel ses kayıt ve transkripsiyon çözümünüz 🎙️