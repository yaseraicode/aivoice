export interface GeminiKey {
  id: string;
  name: string;
  key: string; // encrypted
  isActive: boolean;
  createdAt: string;
  lastUsed: string;
  failedAttempts: number;
  lastFailedAt?: string;
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
      lastUsed: '',
      failedAttempts: 0
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
      key.failedAttempts = 0; // Reset failed attempts on success
      this.saveKeys();
    }
  }

  // Mark key as failed
  markKeyAsFailed(keyId: string): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.failedAttempts += 1;
      key.lastFailedAt = new Date().toISOString();

      // Disable key if too many failures
      if (key.failedAttempts >= 3) {
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

  // Test a key
  async testKey(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Test' }]
          }],
          generationConfig: {
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
    const failed = this.keys.filter(key => key.failedAttempts > 0).length;

    return { total, active, failed };
  }

  // Clear all keys
  clearAllKeys(): void {
    this.keys = [];
    this.currentKeyIndex = 0;
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
