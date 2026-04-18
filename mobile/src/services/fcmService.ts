import messaging from '@react-native-firebase/messaging';
import {FCMMessage, Post} from '../types';
import {useAppStore} from '../store/useAppStore';
import {notifeeService} from './notifeeService';

const FLAIR_TO_TOPIC: Record<string, string> = {
  'paid-no-ai': 'paid_no_ai',
  'paid-ai-ok': 'paid_ai_ok',
  free: 'free_posts',
};

const normalizeFlair = (flair: string | undefined): string => {
  if (!flair) {
    return '';
  }

  return flair
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-');
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

export const handleIncomingFCMData = async (message: FCMMessage | undefined): Promise<void> => {
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
          flair: message.flair || 'Unknown',
          title: message.title || '',
          permalink: message.permalink || '',
          imageUrls: parseImageUrls(message.imageUrls),
          detectedBudget: message.detectedBudget || null,
          status: 'open',
          createdAt: parseInt(message.createdAt || '0', 10) * 1000,
        };

        addPost(post);
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
      break;

    case 'EXPIRED':
      if (message.postId) {
        removePost(message.postId);
      }
      break;

    case 'FLAIR_UPDATE':
      if (message.postId && message.newFlair) {
        updatePostFlair(message.postId, message.newFlair);

        if (isTracked(message.postId) && isFlairEnabled(message.newFlair)) {
          const {posts} = useAppStore.getState();
          const post = posts.find((p) => p.id === message.postId);
          if (post) {
            await notifeeService.showStatusUpdateNotification(post.title, message.newFlair);
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
  async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    return enabled;
  }

  async subscribeToTopics(): Promise<void> {
    const {settings} = useAppStore.getState();

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
  }

  async unsubscribeFromAllTopics(): Promise<void> {
    for (const topic of Object.values(FLAIR_TO_TOPIC)) {
      await messaging().unsubscribeFromTopic(topic);
    }
  }

  setupMessageHandlers(): () => void {
    // Foreground messages
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      await handleIncomingFCMData(remoteMessage.data as FCMMessage);
    });

    return unsubscribe;
  }
}

export const fcmService = new FCMService();
