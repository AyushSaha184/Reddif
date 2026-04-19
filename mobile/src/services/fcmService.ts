import messaging from '@react-native-firebase/messaging';
import {PermissionsAndroid, Platform} from 'react-native';
import {FCMMessage, Post} from '../types';
import {useAppStore} from '../store/useAppStore';
import {notifeeService} from './notifeeService';

const FLAIR_TO_TOPIC: Record<string, string> = {
  'paid-no-ai': 'paid_no_ai',
  'paid-ai-ok': 'paid_ai_ok',
  free: 'free_posts',
};

const LEGACY_TOPICS = ['paid_noai', 'paid_ai', 'free'];

const normalizeFlair = (flair: string | undefined): string => {
  if (!flair) {
    return '';
  }

  return flair
    .trim()
    .toLowerCase()
    .replace(/:[a-z0-9_+-]+:/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const canonicalizeFlairLabel = (flair: string | undefined): string => {
  const normalized = normalizeFlair(flair);
  const hasPaidToken = /(?:^|-)paid(?:-|$)/.test(normalized);
  const hasNoAiToken = /(?:^|-)no-ai(?:-|$)/.test(normalized);
  const hasAiOkToken = /(?:^|-)ai-ok(?:-|$)/.test(normalized);
  const hasAiToken = /(?:^|-)ai(?:-|$)/.test(normalized);
  const hasOkToken = /(?:^|-)ok(?:-|$)/.test(normalized);

  if (!normalized) {
    return 'Unknown';
  }

  if (/^solved(?:-|$)/.test(normalized)) {
    return 'Solved';
  }

  if (/^free(?:-|$)/.test(normalized)) {
    return 'Free';
  }

  if (hasPaidToken && hasNoAiToken) {
    return 'Paid - No AI';
  }

  if (hasPaidToken && (hasAiOkToken || (hasAiToken && hasOkToken))) {
    return 'Paid - AI OK';
  }

  return flair || 'Unknown';
};

const isFlairEnabled = (flair: string | undefined): boolean => {
  const {settings} = useAppStore.getState();
  const normalized = normalizeFlair(flair);

  if (normalized === 'paid-no-ai') {
    return settings.notifToggles.paidNoAI;
  }

  if (normalized === 'paid-ai-ok') {
    return settings.notifToggles.paidAIOK;
  }

  if (normalized === 'free') {
    return settings.notifToggles.free;
  }

  return false;
};

const parseImageUrls = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface HandleIncomingOptions {
  isBackgroundHandler?: boolean;
}

export const handleIncomingFCMData = async (
  message: FCMMessage | undefined,
  options: HandleIncomingOptions = {}
): Promise<void> => {
  if (!message) {
    return;
  }

  const {
    addPost,
    removePost,
    updatePostFlair,
    isTracked,
  } = useAppStore.getState();

  switch (message.type) {
    case 'NEW_POST':
      if (message.postId) {
        if (!isFlairEnabled(message.flair)) {
          return;
        }

        const post: Post = {
          id: message.postId,
          flair: canonicalizeFlairLabel(message.flair),
          title: message.title || '',
          body: message.body || '',
          permalink: message.permalink || '',
          imageUrls: parseImageUrls(message.imageUrls),
          detectedBudget: message.detectedBudget || null,
          status: 'open',
          createdAt: parseInt(message.createdAt || '0', 10) * 1000,
        };

        addPost(post);
        // NEW_POST already contains an FCM notification payload from backend.
        // In background, Android auto-displays it, so skip local notifee to avoid duplicates.
        if (!options.isBackgroundHandler) {
          try {
            await notifeeService.showNewPostNotification(
              post.title,
              post.flair,
              post.detectedBudget
            );
          } catch (error) {
            // Keep data handling successful even if local notification display fails.
            console.warn('Failed to show NEW_POST notification', error);
          }
        }
      }
      break;

    case 'EXPIRED':
      if (message.postId) {
        removePost(message.postId);
      }
      break;

    case 'FLAIR_UPDATE':
      if (message.postId && message.newFlair) {
        const canonicalNewFlair = canonicalizeFlairLabel(message.newFlair);
        updatePostFlair(message.postId, canonicalNewFlair);

        if (isTracked(message.postId) && isFlairEnabled(canonicalNewFlair)) {
          const {posts} = useAppStore.getState();
          const post = posts.find((p) => p.id === message.postId);
          if (post) {
            await notifeeService.showStatusUpdateNotification(post.title, canonicalNewFlair);
          }
        }
      }
      break;

    case 'SOLVED':
      if (message.postId) {
        updatePostFlair(message.postId, 'Solved');
      }
      break;

    default:
      break;
  }
};

class FCMService {
  private async hasNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!granted) {
        return false;
      }
    }

    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  async requestPermission(): Promise<boolean> {
    // Android 13+ requires explicit POST_NOTIFICATIONS runtime permission.
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    return enabled;
  }

  async subscribeToTopics(): Promise<void> {
    const {settings} = useAppStore.getState();

    const hasPermission = await this.hasNotificationPermission();
    if (!hasPermission) {
      await this.unsubscribeFromAllTopics();
      return;
    }

    // Ensure device is registered and token exists before topic operations.
    await messaging().registerDeviceForRemoteMessages();
    const token = await messaging().getToken();
    if (!token) {
      console.warn('FCM token unavailable; skipping topic subscription sync');
      return;
    }

    const topicPlan = [
      {topic: FLAIR_TO_TOPIC['paid-no-ai'], enabled: settings.notifToggles.paidNoAI},
      {topic: FLAIR_TO_TOPIC['paid-ai-ok'], enabled: settings.notifToggles.paidAIOK},
      {topic: FLAIR_TO_TOPIC.free, enabled: settings.notifToggles.free},
    ];

    for (const {topic, enabled} of topicPlan) {
      if (enabled) {
        await messaging().subscribeToTopic(topic);
      } else {
        await messaging().unsubscribeFromTopic(topic);
      }
    }

    // Keep modern clients off legacy aliases to prevent duplicate delivery.
    for (const legacyTopic of LEGACY_TOPICS) {
      await messaging().unsubscribeFromTopic(legacyTopic);
    }
  }

  async unsubscribeFromAllTopics(): Promise<void> {
    for (const topic of Object.values(FLAIR_TO_TOPIC)) {
      await messaging().unsubscribeFromTopic(topic);
    }

    for (const legacyTopic of LEGACY_TOPICS) {
      await messaging().unsubscribeFromTopic(legacyTopic);
    }
  }

  setupMessageHandlers(): () => void {
    // Foreground messages
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      const data = remoteMessage.data;
      if (!data || typeof data.type !== 'string') {
        return;
      }

      await handleIncomingFCMData(data as unknown as FCMMessage);
    });

    return unsubscribe;
  }
}

export const fcmService = new FCMService();
