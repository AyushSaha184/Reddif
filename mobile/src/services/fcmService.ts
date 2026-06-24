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

// Issue #25: Use canonicalizeFlairLabel for consistent matching with backend.
const isFlairEnabled = (flair: string | undefined): boolean => {
  const {settings} = useAppStore.getState();
  const toggles = settings?.notifToggles ?? {paidNoAI: true, paidAIOK: true, free: true};
  const canonical = canonicalizeFlairLabel(flair);

  if (canonical === 'Paid - No AI') {
    return toggles.paidNoAI;
  }

  if (canonical === 'Paid - AI OK') {
    return toggles.paidAIOK;
  }

  if (canonical === 'Free') {
    return toggles.free;
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
    isBookmarked,
  } = useAppStore.getState();

  switch (message.type) {
    case 'NEW_POST':
      if (message.postId) {
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

        if (isFlairEnabled(message.flair) && !options.isBackgroundHandler) {
          try {
            await notifeeService.showNewPostNotification(
              post.title,
              post.flair,
              post.detectedBudget
            );
          } catch (error) {
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

        if (canonicalNewFlair === 'Solved' && isBookmarked(message.postId)) {
          const {posts} = useAppStore.getState();
          const post = posts.find((p) => p.id === message.postId);
          if (post) {
            await notifeeService.showStatusUpdateNotification(post.title, 'Solved');
          }
        }
      }
      break;

    case 'SOLVED':
      if (message.postId) {
        updatePostFlair(message.postId, 'Solved');

        if (isBookmarked(message.postId)) {
          const {posts} = useAppStore.getState();
          const post = posts.find((p) => p.id === message.postId);
          if (post) {
            await notifeeService.showStatusUpdateNotification(post.title, 'Solved');
          }
        }
      }
      break;

    default:
      break;
  }
};

class FCMService {
  private lastTopicSyncKey: string | null = null;
  private hasRegisteredForRemoteMessages = false;

  private async hasNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        return PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }

      return true;
    }

    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      // Android 13+ uses the platform notification runtime permission.
      // Avoid calling Firebase's permission API too, or the user can see a
      // second system prompt on fresh install.
      if (Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }

      return true;
    }

    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  async subscribeToTopics(): Promise<void> {
    const {settings} = useAppStore.getState();

    const hasPermission = await this.hasNotificationPermission();
    const syncKey = JSON.stringify({
      hasPermission,
      toggles: settings.notifToggles,
    });

    if (syncKey === this.lastTopicSyncKey) {
      return;
    }

    if (!hasPermission) {
      await this.unsubscribeFromAllTopics();
      this.lastTopicSyncKey = syncKey;
      return;
    }

    // Ensure device is registered and token exists before topic operations.
    if (!this.hasRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
      this.hasRegisteredForRemoteMessages = true;
    }
    const token = await messaging().getToken();
    if (!token) {
      console.warn('FCM token unavailable; skipping topic subscription sync');
      return;
    }

    const toggles = settings?.notifToggles ?? { paidNoAI: true, paidAIOK: true, free: true };
    const topicPlan = [
      {topic: FLAIR_TO_TOPIC['paid-no-ai'], enabled: toggles.paidNoAI},
      {topic: FLAIR_TO_TOPIC['paid-ai-ok'], enabled: toggles.paidAIOK},
      {topic: FLAIR_TO_TOPIC.free, enabled: toggles.free},
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

    this.lastTopicSyncKey = syncKey;
  }

  async unsubscribeFromAllTopics(): Promise<void> {
    for (const topic of Object.values(FLAIR_TO_TOPIC)) {
      await messaging().unsubscribeFromTopic(topic);
    }

    for (const legacyTopic of LEGACY_TOPICS) {
      await messaging().unsubscribeFromTopic(legacyTopic);
    }

    this.lastTopicSyncKey = null;
  }

  /**
   * Issue #26: Force re-sync of topic subscriptions.
   * Call when the app comes to foreground or permission state may have changed.
   */
  resetSyncState(): void {
    this.lastTopicSyncKey = null;
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
