import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Edit3, Check, X, Key, Eye, EyeOff, TestTube, AlertTriangle, Info, Save, RotateCcw } from 'lucide-react';
import { GeminiKeyManager, GeminiKey } from '../services/GeminiKeyManager';

const SettingsPage: React.FC = () => {
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', apiKey: '' });
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeyValue, setShowKeyValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [keyManager] = useState(() => GeminiKeyManager.getInstance());

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = () => {
    setKeys(keyManager.getAllKeys());
  };

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddKey = () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      showNotification('error', 'Lütfen anahtar adı ve değerini girin.');
      return;
    }

    if (newKeyValue.trim().length < 5) {
      showNotification('error', 'API anahtarı en az 5 karakter olmalıdır.');
      return;
    }

    // Check for duplicate keys
    const existingKey = keys.find(key => key.key === newKeyValue.trim());
    if (existingKey) {
      showNotification('warning', 'Bu API anahtarı zaten mevcut.');
      return;
    }

    keyManager.addKey(newKeyName, newKeyValue);
    setNewKeyName('');
    setNewKeyValue('');
    setIsAddingKey(false);
    loadKeys();
    showNotification('success', 'API anahtarı başarıyla eklendi.');
  };

  const handleDeleteKey = (id: string) => {
    if (window.confirm('Bu anahtarı silmek istediğinizden emin misiniz?')) {
      keyManager.deleteKey(id);
      loadKeys();
      showNotification('success', 'API anahtarı silindi.');
    }
  };

  const handleToggleKeyStatus = (id: string, isActive: boolean) => {
    keyManager.updateKey(id, { isActive: !isActive });
    loadKeys();
    showNotification('success', `API anahtarı ${!isActive ? 'aktif' : 'pasif'} duruma getirildi.`);
  };

  const handleEditKey = (key: GeminiKey) => {
    setEditingKey(key.id);
    setEditForm({ name: key.name, apiKey: key.key });
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;

    setIsLoading(true);
    try {
      const result = keyManager.editKey(editingKey, editForm.name, editForm.apiKey);

      if (result.success) {
        setEditingKey(null);
        setEditForm({ name: '', apiKey: '' });
        loadKeys();
        showNotification('success', 'API anahtarı başarıyla güncellendi.');
      } else {
        showNotification('error', result.error || 'Düzenleme sırasında hata oluştu.');
      }
    } catch (error) {
      showNotification('error', 'Düzenleme sırasında beklenmeyen hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditForm({ name: '', apiKey: '' });
  };

  const handleTestKey = async (keyId: string) => {
    try {
      const result = await keyManager.testGeminiKey(keyId);

      if (result.success) {
        showNotification('success', 'API anahtarı test edildi - Çalışıyor ✅');
      } else {
        showNotification('error', `API anahtarı test edildi - Hatalı: ${result.error}`);
      }

      loadKeys(); // Refresh to show updated status
    } catch (error) {
      showNotification('error', 'Test sırasında beklenmeyen hata oluştu.');
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeyValue(showKeyValue === keyId ? null : keyId);
  };

  const maskApiKey = (key: string): string => {
    if (key.length <= 8) return key;
    return `${key.substring(0, 8)}${'*'.repeat(key.length - 8)}`;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Hiç test edilmedi';
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const getKeyStats = () => {
    return keyManager.getKeyStats();
  };

  const stats = getKeyStats();

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          Gemini API Anahtar Yönetimi
        </h2>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Aktif: {stats.active}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>Pasif: {stats.total - stats.active}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>Hatalı: {stats.failed}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-800 mb-1">Bilgi</h3>
              <p className="text-sm text-blue-700">
                Gemini API anahtarlarınız yerel depolamada şifrelenmiş olarak saklanır.
                Anahtarlar round-robin mantığıyla otomatik olarak döndürülür.
                Hatalı anahtarlar otomatik olarak devre dışı bırakılır.
              </p>
            </div>
          </div>
        </div>

        {/* Add Key Button */}
        <div className="mb-6">
          <button
            onClick={() => setIsAddingKey(!isAddingKey)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Yeni Anahtar Ekle
          </button>
        </div>

        {/* Add Key Form */}
        {isAddingKey && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Yeni Anahtar Ekle</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anahtar Adı
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Örn: Ana Anahtar 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Anahtarı
                </label>
                <input
                  type="password"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="AIzaSyB97Y46aps-D-cIw7jG44EXIJbBQYc91lU"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddKey}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Ekle
                </button>
                <button
                  onClick={() => {
                    setIsAddingKey(false);
                    setNewKeyName('');
                    setNewKeyValue('');
                  }}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' && <Check className="w-5 h-5" />}
              {notification.type === 'error' && <X className="w-5 h-5" />}
              {notification.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingKey && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                API Anahtarı Düzenle
              </h2>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Anahtar Adı:
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      placeholder="Örn: Ana Key, Yedek Key 1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      minLength={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Anahtarı:
                    </label>
                    <input
                      type="text"
                      value={editForm.apiKey}
                      onChange={(e) => setEditForm({...editForm, apiKey: e.target.value})}
                      placeholder="API anahtarı..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      required
                      minLength={5}
                    />
                    <small className="text-gray-500 text-xs mt-1 block">
                      API anahtarı en az 5 karakter olmalıdır
                    </small>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Keys List */}
        <div className="space-y-4">
          {keys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">Henüz hiç anahtar eklenmemiş</p>
              <p className="text-gray-400 text-sm">
                Yukarıdaki "Yeni Anahtar Ekle" butonuna tıklayarak başlayın
              </p>
            </div>
          ) : (
            keys.map((key) => (
              <div key={key.id} className={`key-item border rounded-lg p-4 shadow-sm ${
                key.isActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="key-info flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`status text-lg ${
                      key.isActive ? '🟢' : '🔴'
                    }`}>
                      {key.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-800">{key.name}</h3>
                    {key.failureCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">Hata: {key.failureCount}</span>
                      </div>
                    )}
                  </div>

                  <div className="key-actions flex items-center gap-2">
                    <button
                      onClick={() => handleTestKey(key.id)}
                      disabled={key.testStatus === 'testing'}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {key.testStatus === 'testing' ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                      {key.testStatus === 'testing' ? 'Test ediliyor...' : 'Test Et'}
                    </button>
                    <button
                      onClick={() => handleToggleKeyStatus(key.id, key.isActive)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
                        key.isActive
                          ? 'bg-orange-600 hover:bg-orange-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {key.isActive ? 'Pasife Çek' : 'Aktife Çek'}
                    </button>
                    <button
                      onClick={() => handleEditKey(key)}
                      className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Sil
                    </button>
                  </div>
                </div>

                {/* Key Value */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">API Anahtarı:</span>
                    <button
                      onClick={() => toggleKeyVisibility(key.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {showKeyValue === key.id ? (
                        <EyeOff className="w-4 h-4 inline" />
                      ) : (
                        <Eye className="w-4 h-4 inline" />
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-sm bg-gray-50 border border-gray-300 rounded px-3 py-2 mt-1">
                    {showKeyValue === key.id ? key.key : maskApiKey(key.key)}
                  </div>
                </div>

                {/* Test Result */}
                {key.testResult === 'failed' && key.errorMessage && (
                  <div className="error-message mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    ❌ Hata: {key.errorMessage}
                  </div>
                )}

                {/* Key Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Oluşturulma:</span>
                    <br />
                    {new Date(key.createdAt).toLocaleDateString('tr-TR')}
                  </div>
                  <div>
                    <span className="font-medium">Güncellenme:</span>
                    <br />
                    {new Date(key.updatedAt).toLocaleDateString('tr-TR')}
                  </div>
                  <div>
                    <span className="font-medium">Son Test:</span>
                    <br />
                    {formatDate(key.lastTested)}
                  </div>
                  <div>
                    <span className="font-medium">Hata Sayısı:</span>
                    <br />
                    {key.failureCount}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
