import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HMAC_SECRET_KEY = '@hmac_secret';

const getHmacSecret = async (): Promise<string> => {
  const stored = await AsyncStorage.getItem(HMAC_SECRET_KEY);
  if (!stored) {
    throw new Error('HMAC secret not configured. Set it in Settings.');
  }
  return stored;
};

let cachedSecret: string | null = null;

/**
 * Generate HMAC-SHA256 signature for API requests
 * @param message - The message to sign (format: "METHOD:/path:timestamp:nonce")
 * @returns Hex-encoded HMAC signature
 */
export async function generateHmacSignature(message: string): Promise<string> {
  if (!cachedSecret) {
    try {
      cachedSecret = await getHmacSecret();
    } catch {
      console.warn('HMAC secret not configured. Set it in Settings.');
      cachedSecret = '';
    }
  }

  if (!cachedSecret) {
    throw new Error('HMAC secret not configured');
  }

  return CryptoJS.HmacSHA256(message, cachedSecret).toString();
}

export async function setHmacSecret(secret: string): Promise<void> {
  await AsyncStorage.setItem(HMAC_SECRET_KEY, secret);
  cachedSecret = secret;
}

export async function hasHmacSecretConfigured(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(HMAC_SECRET_KEY);
  return Boolean(stored && stored.trim().length > 0);
}