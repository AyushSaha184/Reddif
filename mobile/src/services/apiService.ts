import axios, {AxiosInstance, AxiosRequestConfig, AxiosError} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Post} from '../types';
import {generateHmacSignature} from './hmacService';

const logger = {
  info: (msg: string, data?: Record<string, unknown>) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, data || ''),
};

const API_URL_KEY = '@backend_url';
const DEFAULT_LOCAL_URL = 'http://localhost:8000';

/**
 * Get backend URL from storage
 * Falls back to default for development
 */
export const getBackendUrl = async (): Promise<string> => {
  try {
    const storedUrl = await AsyncStorage.getItem(API_URL_KEY);
    if (storedUrl && storedUrl.length > 0) {
      logger.info('using_stored_backend_url', {url: storedUrl.substring(0, 20) + '...'});
      return storedUrl;
    }
  } catch (error) {
    logger.error('failed_to_get_stored_url', {error: String(error)});
  }
  
  // Fallback for development
  return DEFAULT_LOCAL_URL;
};

/**
 * Save backend URL to storage
 */
export const setBackendUrl = async (url: string): Promise<void> => {
  try {
    // Validate URL format
    const validUrl = url.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      throw new Error('URL must start with http:// or https://');
    }
    
    await AsyncStorage.setItem(API_URL_KEY, validUrl);
    logger.info('backend_url_saved', {url: validUrl.substring(0, 20) + '...'});
  } catch (error) {
    logger.error('failed_to_save_url', {error: String(error)});
    throw error;
  }
};

/**
 * Force HTTPS for non-local URLs
 */
const getSecureUrl = (url: string): string => {
  const isLocal = url.startsWith('http://localhost') || 
                  url.startsWith('http://10.') ||
                  url.startsWith('http://192.') ||
                  url.startsWith('http://127.');
  
  if (!isLocal) {
    return url.replace('http://', 'https://');
  }
  return url;
};

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  timeout: 15000,
  validateStatus: (status) => status < 500,
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    const baseUrl = await getBackendUrl();
    config.baseURL = getSecureUrl(baseUrl);

    const headers = config.headers ?? {};
    let timestamp = headers['X-Timestamp'] as string | undefined;
    let nonce = headers['X-Nonce'] as string | undefined;

    if (!timestamp || !nonce) {
      timestamp = Math.floor(Date.now() / 1000).toString();
      nonce = generateNonce();
      headers['X-Timestamp'] = timestamp;
      headers['X-Nonce'] = nonce;
    }

    config.headers = headers;

    logger.info('api_request', {
      method: config.method,
      url: config.url,
      baseUrl: config.baseURL,
      timestamp,
      nonce: nonce.substring(0, 8) + '...',
    });

    return config;
  },
  (error) => {
    logger.error('api_request_error', { error: error.message });
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    logger.info('api_response', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      logger.error('api_response_error', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        data: error.response.data
      });
    } else if (error.request) {
      logger.error('api_network_error', {
        message: error.message,
        url: error.config?.url
      });
    } else {
      logger.error('api_error', { message: error.message });
    }
    return Promise.reject(error);
  }
);

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const apiService = {
  async getPost(postId: string): Promise<Post | null> {
    try {
      const response = await apiClient.get(`/post/${postId}`);
      const data = response.data;
      
      if (!data) {
        logger.warn('getPost_no_data', { postId });
        return null;
      }
      
      return {
        id: data.post_id,
        flair: data.flair,
        title: data.title,
        permalink: data.permalink,
        imageUrls: typeof data.image_urls === 'string' 
          ? JSON.parse(data.image_urls || '[]') 
          : data.image_urls || [],
        detectedBudget: data.detected_budget,
        status: data.status,
        createdAt: data.created_at * 1000,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          logger.warn('getPost_not_found', { postId });
        } else {
          logger.error('getPost_error', { postId, error: error.message });
        }
      }
      return null;
    }
  },

  async markSolved(postId: string): Promise<boolean> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = generateNonce();
      const baseUrl = await getBackendUrl();
      const message = `POST:/mark-solved/${postId}:${timestamp}:${nonce}`;
      
      logger.info('markSolved_request', { postId, timestamp, nonce: nonce.substring(0, 8) + '...' });
      
      const signature = await generateHmacSignature(message);
      
      const response = await apiClient.post(
        `/mark-solved/${postId}`,
        {},
        {
          headers: {
            'X-Signature': signature,
            'X-Timestamp': timestamp.toString(),
            'X-Nonce': nonce,
          },
        }
      );
      
      if (response.status === 200) {
        logger.info('markSolved_success', { postId });
        return true;
      }
      
      logger.warn('markSolved_failed', { postId, status: response.status });
      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('markSolved_error', { postId, error: error.message, status: error.response?.status });
      }
      return false;
    }
  },

  async checkHealth(): Promise<{status: string; timestamp: number} | null> {
    try {
      const response = await apiClient.get('/health');
      logger.info('health_check_response', { status: response.status, data: response.data });
      return response.data;
    } catch (error) {
      logger.error('health_check_error', { error: axios.isAxiosError(error) ? error.message : 'unknown' });
      return null;
    }
  },
  
  // Export for settings screen
  getBackendUrl,
  setBackendUrl,
};
