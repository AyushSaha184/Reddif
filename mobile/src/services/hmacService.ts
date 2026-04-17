import {createHmac} from 'crypto';
import {NativeModules} from 'react-native';

const HMAC_SECRET = NativeModules.HMAC_SECRET || 'default_secret_change_me';

/**
 * Generate HMAC-SHA256 signature for API requests
 * @param message - The message to sign (format: "METHOD:/path:timestamp:nonce")
 * @returns Hex-encoded HMAC signature
 */
export async function generateHmacSignature(message: string): Promise<string> {
  try {
    const hmac = createHmac('sha256', HMAC_SECRET);
    hmac.update(message);
    return hmac.digest('hex');
  } catch (error) {
    console.error('HMAC generation failed:', error);
    throw new Error('Failed to generate HMAC signature');
  }
}