export interface GeminiKey {
  id: string;
  name: string;
  key: string; // encrypted
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsed: string;
  lastTested: string;
  testResult: 'success' | 'failed' | 'never';
  testStatus: 'idle' | 'testing' | 'success' | 'failed';
  errorMessage: string | null;
  failureCount: number;
}

export interface KeyStorage {
  geminiKeys: GeminiKey[];
  lastRotated: string;
}

export class GeminiKeyManager {
  private static instance: GeminiKeyManager;
  private keys: GeminiKey[] = [];
  private currentKeyIndex = 0;
  private readonly STORAGE_KEY = 'gemini-api-keys';
  private readonly ENCRYPTION_KEY = 'voice-script-encryption-key';

  private constructor() {
    this.loadKeys();
  }

  static getInstance(): GeminiKeyManager {
    if (!GeminiKeyManager.instance) {
      GeminiKeyManager.instance = new GeminiKeyManager();
    }
    return GeminiKeyManager.instance;
  }

  // Load keys from localStorage
  private loadKeys(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data: KeyStorage = JSON.parse(stored);
        this.keys = data.geminiKeys.map(key => ({
          ...key,
          key: this.decrypt(key.key)
        }));
        this.currentKeyIndex = data.lastRotated ? this.getNextActiveKeyIndex() : 0;
      }
    } catch (error) {
      console.error('Error loading keys from localStorage:', error);
      this.keys = [];
    }
  }

  // Save keys to localStorage
  private saveKeys(): void {
    try {
      const data: KeyStorage = {
        geminiKeys: this.keys.map(key => ({
          ...key,
          key: this.encrypt(key.key)
        })),
        lastRotated: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving keys to localStorage:', error);
    }
  }

  // Simple encryption/decryption using base64
  private encrypt(text: string): string {
    try {
      return btoa(text);
    } catch (error) {
      console.error('Encryption error:', error);
      return text;
    }
  }

  private decrypt(encrypted: string): string {
    try {
      return atob(encrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return encrypted;
    }
  }

  // Get all keys
  getAllKeys(): GeminiKey[] {
    return [...this.keys];
  }

  // Add a new key
  addKey(name: string, apiKey: string): void {
    const newKey: GeminiKey = {
      id: Date.now().toString(),
      name: name.trim(),
      key: apiKey.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsed: '',
      lastTested: '',
      testResult: 'never',
      testStatus: 'idle',
      errorMessage: null,
      failureCount: 0
    };

    this.keys.push(newKey);
    this.saveKeys();
  }

  // Update a key
  updateKey(id: string, updates: Partial<Omit<GeminiKey, 'id' | 'createdAt'>>): void {
    const index = this.keys.findIndex(key => key.id === id);
    if (index !== -1) {
      this.keys[index] = { ...this.keys[index], ...updates };
      this.saveKeys();
    }
  }

  // Delete a key
  deleteKey(id: string): void {
    this.keys = this.keys.filter(key => key.id !== id);
    this.saveKeys();

    // Reset current index if it was pointing to deleted key
    if (this.currentKeyIndex >= this.keys.length) {
      this.currentKeyIndex = 0;
    }
  }

  // Get current active key
  getCurrentKey(): GeminiKey | null {
    const activeKeys = this.keys.filter(key => key.isActive);
    if (activeKeys.length === 0) return null;

    if (this.currentKeyIndex >= activeKeys.length) {
      this.currentKeyIndex = 0;
    }

    return activeKeys[this.currentKeyIndex] || null;
  }

  // Mark key as used
  markKeyAsUsed(keyId: string): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.lastUsed = new Date().toISOString();
      key.failureCount = 0; // Reset failure count on success
      this.saveKeys();
    }
  }

  // Mark key as failed
  markKeyAsFailed(keyId: string): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.failureCount += 1;

      // Disable key if too many failures
      if (key.failureCount >= 3) {
        key.isActive = false;
      }

      this.saveKeys();
    }
  }

  // Rotate to next key
  rotateKey(): void {
    const activeKeys = this.keys.filter(key => key.isActive);
    if (activeKeys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % activeKeys.length;
    }
  }

  // Get next active key index
  private getNextActiveKeyIndex(): number {
    const activeKeys = this.keys.filter(key => key.isActive);
    return activeKeys.length > 0 ? 0 : 0;
  }

  // Check if we have any valid keys
  hasValidKeys(): boolean {
    return this.keys.some(key => key.isActive);
  }

  // Edit a key with validation
  editKey(id: string, name: string, apiKey: string): { success: boolean; error?: string } {
    // Validation
    if (!name.trim()) {
      return { success: false, error: 'Anahtar adı boş olamaz' };
    }

    if (name.trim().length < 3) {
      return { success: false, error: 'Anahtar adı en az 3 karakter olmalıdır' };
    }

    if (!apiKey.trim()) {
      return { success: false, error: 'API anahtarı boş olamaz' };
    }

    if (apiKey.trim().length < 5) {
      return { success: false, error: 'API anahtarı en az 5 karakter olmalıdır' };
    }

    // Check for duplicate keys (excluding current key)
    const existingKey = this.keys.find(key =>
      key.key === apiKey.trim() && key.id !== id
    );
    if (existingKey) {
      return { success: false, error: 'Bu API anahtarı zaten mevcut' };
    }

    // Update the key
    const index = this.keys.findIndex(key => key.id === id);
    if (index === -1) {
      return { success: false, error: 'Anahtar bulunamadı' };
    }

    this.keys[index] = {
      ...this.keys[index],
      name: name.trim(),
      key: apiKey.trim(),
      updatedAt: new Date().toISOString(),
      testResult: 'never', // Reset test status after edit
      testStatus: 'idle',
      errorMessage: null
    };

    this.saveKeys();
    return { success: true };
  }

  // Get key by ID
  getKeyById(id: string): GeminiKey | null {
    return this.keys.find(key => key.id === id) || null;
  }

  // Set test status for a key
  setKeyTestStatus(id: string, status: 'idle' | 'testing' | 'success' | 'failed'): void {
    const key = this.keys.find(k => k.id === id);
    if (key) {
      key.testStatus = status;
      this.saveKeys();
    }
  }

  // Update key status after test
  updateKeyStatus(id: string, updates: Partial<Pick<GeminiKey, 'isActive' | 'lastTested' | 'testResult' | 'errorMessage'>>): void {
    const key = this.keys.find(k => k.id === id);
    if (key) {
      Object.assign(key, updates);
      this.saveKeys();
    }
  }

  // Enhanced test key with automatic status management
  async testGeminiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
    const key = this.getKeyById(keyId);
    if (!key) {
      return { success: false, error: 'Anahtar bulunamadı' };
    }

    console.log('Testing Gemini API key:', key.name);

    try {
      // Set loading state
      this.setKeyTestStatus(keyId, 'testing');

      // Test with primary model first
      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key.key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Merhaba! Bu bir test mesajıdır. Lütfen sadece "TEST BAŞARILI" yazarak yanıt ver.'
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50
          }
        })
      });

      // If primary model fails with 404, try fallback model
      if (response.status === 404) {
        console.log('Primary model not found, trying fallback model...');
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key.key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: 'Merhaba! Bu bir test mesajıdır. Lütfen sadece "TEST BAŞARILI" yazarak yanıt ver.'
              }]
            }]
          })
        });
      }

      const currentTime = new Date().toISOString();

      if (response.ok) {
        console.log('Gemini API test successful for key:', key.name);
        // Test successful
        this.updateKeyStatus(keyId, {
          isActive: true,
          lastTested: currentTime,
          testResult: 'success',
          errorMessage: null
        });

        this.setKeyTestStatus(keyId, 'success');
        return { success: true };
      } else {
        // Test failed - parse error
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorData = await response.json();
          console.error('Gemini API Error:', errorData);

          switch (response.status) {
            case 400:
              errorMessage = 'Geçersiz istek - API parametreleri hatalı';
              break;
            case 401:
              errorMessage = 'API key geçersiz veya süresi dolmuş';
              break;
            case 403:
              errorMessage = 'API key bu servise erişim yetkisi yok';
              break;
            case 404:
              errorMessage = 'Model bulunamadı - API güncellenmiş olabilir';
              break;
            case 429:
              errorMessage = 'Rate limit aşıldı, daha sonra tekrar deneyin';
              break;
            case 500:
              errorMessage = 'Sunucu hatası - Daha sonra tekrar deneyin';
              break;
            default:
              errorMessage = `API Hatası: ${response.status}`;
              if (errorData?.error?.message) {
                errorMessage += ` - ${errorData.error.message}`;
              }
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          // If we can't parse the error response, use generic message
        }

        console.error('Gemini API test failed for key:', key.name, 'Error:', errorMessage);

        // Test failed - disable key
        this.updateKeyStatus(keyId, {
          isActive: false,
          lastTested: currentTime,
          testResult: 'failed',
          errorMessage: errorMessage
        });

        this.setKeyTestStatus(keyId, 'failed');
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Network error during test:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      const currentTime = new Date().toISOString();

      // Network or other error
      this.updateKeyStatus(keyId, {
        isActive: false,
        lastTested: currentTime,
        testResult: 'failed',
        errorMessage: 'İnternet bağlantısı sorunu: ' + errorMessage
      });

      this.setKeyTestStatus(keyId, 'failed');
      return { success: false, error: 'İnternet bağlantısı sorunu: ' + errorMessage };
    }
  }

  // Test a key (legacy method for backward compatibility)
  async testKey(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Test mesajı - sadece "OK" yanıtla' }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10
          }
        })
      });

      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${error}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get key statistics
  getKeyStats(): { total: number; active: number; failed: number } {
    const total = this.keys.length;
    const active = this.keys.filter(key => key.isActive).length;
    const failed = this.keys.filter(key => key.failureCount > 0).length;

    return { total, active, failed };
  }

  // Clear all keys
  clearAllKeys(): void {
    this.keys = [];
    this.currentKeyIndex = 0;
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
