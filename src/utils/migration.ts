import { GeminiKeyManager } from '../services/GeminiKeyManager';

export const migrateExistingEnvKey = () => {
  try {
    // Check if there's an existing key in .env
    const existingKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

    if (existingKey && existingKey.trim()) {
      const keyManager = GeminiKeyManager.getInstance();

      // Check if this key is already migrated
      const existingKeys = keyManager.getAllKeys();
      const keyAlreadyExists = existingKeys.some(key => key.key === existingKey.trim());

      if (!keyAlreadyExists) {
        console.log('Migrating existing .env Gemini API key to local storage...');

        // Add the existing key to the key manager
        keyManager.addKey('Migrated from .env', existingKey.trim());

        console.log('✅ Migration completed successfully!');
        console.log('📝 Note: You can now safely remove VITE_GEMINI_API_KEY from your .env file');

        return true;
      } else {
        console.log('ℹ️  Existing key already migrated');
        return false;
      }
    } else {
      console.log('ℹ️  No existing .env key found to migrate');
      return false;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
};

export const checkMigrationStatus = (): { migrated: boolean; hasEnvKey: boolean; hasStoredKeys: boolean } => {
  const existingKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const keyManager = GeminiKeyManager.getInstance();
  const storedKeys = keyManager.getAllKeys();

  const hasEnvKey = !!(existingKey && existingKey.trim());
  const hasStoredKeys = storedKeys.length > 0;

  // Check if the env key exists in stored keys
  const envKeyMigrated = hasEnvKey && storedKeys.some(key => key.key === existingKey.trim());

  return {
    migrated: envKeyMigrated,
    hasEnvKey,
    hasStoredKeys
  };
};
