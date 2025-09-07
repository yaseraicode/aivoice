import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Edit3, Check, X, Key, Eye, EyeOff, TestTube, AlertTriangle, Info } from 'lucide-react';
import { GeminiKeyManager, GeminiKey } from '../services/GeminiKeyManager';

const SettingsPage: React.FC = () => {
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeyValue, setShowKeyValue] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [keyManager] = useState(() => GeminiKeyManager.getInstance());

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = () => {
    setKeys(keyManager.getAllKeys());
  };

  const handleAddKey = () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      alert('Lütfen anahtar adı ve değerini girin.');
      return;
    }

    // Basic validation for Gemini API key format
    if (!newKeyValue.startsWith('AIza')) {
      alert('Geçersiz Gemini API anahtarı formatı. Anahtar "AIza" ile başlamalıdır.');
      return;
    }

    keyManager.addKey(newKeyName, newKeyValue);
    setNewKeyName('');
    setNewKeyValue('');
    setIsAddingKey(false);
    loadKeys();
  };

  const handleDeleteKey = (id: string) => {
    if (window.confirm('Bu anahtarı silmek istediğinizden emin misiniz?')) {
      keyManager.deleteKey(id);
      loadKeys();
    }
  };

  const handleToggleKeyStatus = (id: string, isActive: boolean) => {
    keyManager.updateKey(id, { isActive: !isActive });
    loadKeys();
  };

  const handleEditKey = (id: string, name: string, key: string) => {
    setEditingKey(id);
    setNewKeyName(name);
    setNewKeyValue(key);
  };

  const handleSaveEdit = () => {
    if (editingKey && newKeyName.trim() && newKeyValue.trim()) {
      keyManager.updateKey(editingKey, {
        name: newKeyName,
        key: newKeyValue
      });
      setEditingKey(null);
      setNewKeyName('');
      setNewKeyValue('');
      loadKeys();
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setNewKeyName('');
    setNewKeyValue('');
  };

  const handleTestKey = async (keyId: string, apiKey: string) => {
    setTestingKey(keyId);
    setTestResults(prev => ({ ...prev, [keyId]: { success: false } }));

    try {
      const result = await keyManager.testKey(apiKey);
      setTestResults(prev => ({ ...prev, [keyId]: result }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [keyId]: { success: false, error: 'Test sırasında hata oluştu' }
      }));
    } finally {
      setTestingKey(null);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeyValue(showKeyValue === keyId ? null : keyId);
  };

  const maskKey = (key: string): string => {
    if (key.length <= 8) return key;
    return `${key.substring(0, 8)}${'*'.repeat(key.length - 8)}`;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Hiç kullanılmadı';
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
              <div
                key={key.id}
                className={`border rounded-lg p-4 transition-all duration-300 ${
                  key.isActive
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      key.isActive ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <h3 className="text-lg font-semibold text-gray-800">{key.name}</h3>
                    {key.failedAttempts > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">Hata: {key.failedAttempts}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestKey(key.id, key.key)}
                      disabled={testingKey === key.id}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {testingKey === key.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                      Test
                    </button>

                    <button
                      onClick={() => handleToggleKeyStatus(key.id, key.isActive)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
                        key.isActive
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {key.isActive ? 'Devre Dışı' : 'Aktif Et'}
                    </button>

                    <button
                      onClick={() => handleEditKey(key.id, key.name, key.key)}
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

                {/* Test Results */}
                {testResults[key.id] && (
                  <div className={`mb-3 p-3 rounded-lg text-sm ${
                    testResults[key.id].success
                      ? 'bg-green-100 border border-green-200 text-green-800'
                      : 'bg-red-100 border border-red-200 text-red-800'
                  }`}>
                    {testResults[key.id].success ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Anahtar çalışıyor ✅</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4" />
                        <span>Hata: {testResults[key.id].error}</span>
                      </div>
                    )}
                  </div>
                )}

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
                  <div className="font-mono text-sm bg-white border border-gray-300 rounded px-3 py-2 mt-1">
                    {showKeyValue === key.id ? key.key : maskKey(key.key)}
                  </div>
                </div>

                {/* Key Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Oluşturulma:</span>
                    <br />
                    {new Date(key.createdAt).toLocaleDateString('tr-TR')}
                  </div>
                  <div>
                    <span className="font-medium">Son Kullanım:</span>
                    <br />
                    {formatDate(key.lastUsed)}
                  </div>
                  <div>
                    <span className="font-medium">Hata Sayısı:</span>
                    <br />
                    {key.failedAttempts}
                  </div>
                  {key.lastFailedAt && (
                    <div>
                      <span className="font-medium">Son Hata:</span>
                      <br />
                      {formatDate(key.lastFailedAt)}
                    </div>
                  )}
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
