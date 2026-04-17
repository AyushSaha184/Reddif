import messaging from '@react-native-firebase/messaging';
import {FCMMessage, Post} from '../types';
import {useAppStore} from '../store/useAppStore';
import {notifeeService} from './notifeeService';

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
    
    if (settings.notifToggles.paidNoAI) {
      await messaging().subscribeToTopic('paid_no_ai');
    } else {
      await messaging().unsubscribeFromTopic('paid_no_ai');
    }
    
    if (settings.notifToggles.paidAIOK) {
      await messaging().subscribeToTopic('paid_ai_ok');
    } else {
      await messaging().unsubscribeFromTopic('paid_ai_ok');
    }
    
    if (settings.notifToggles.free) {
      await messaging().subscribeToTopic('free_posts');
    } else {
      await messaging().unsubscribeFromTopic('free_posts');
    }
  }

  async unsubscribeFromAllTopics(): Promise<void> {
    await messaging().unsubscribeFromTopic('paid_no_ai');
    await messaging().unsubscribeFromTopic('paid_ai_ok');
    await messaging().unsubscribeFromTopic('free_posts');
  }

  setupMessageHandlers(): void {
    // Foreground messages
    messaging().onMessage(async (remoteMessage) => {
      this.handleFCMMessage(remoteMessage.data as FCMMessage);
    });

    // Background/quit state messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      this.handleFCMMessage(remoteMessage.data as FCMMessage);
    });
  }

  private handleFCMMessage(message: FCMMessage): void {
    if (!message) return;

    const {
      addPost,
      removePost,
      updatePostFlair,
      trackedPosts,
      isTracked,
    } = useAppStore.getState();

    switch (message.type) {
      case 'NEW_POST':
        if (message.postId) {
          const post: Post = {
            id: message.postId,
            flair: message.flair || 'Unknown',
            title: message.title || '',
            permalink: message.permalink || '',
            imageUrls: message.imageUrls ? JSON.parse(message.imageUrls) : [],
            detectedBudget: message.detectedBudget || null,
            status: 'open',
            createdAt: parseInt(message.createdAt || '0') * 1000,
          };
          addPost(post);
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
          
          // If tracked, send local notification
          if (isTracked(message.postId)) {
            const {posts} = useAppStore.getState();
            const post = posts.find((p) => p.id === message.postId);
            if (post) {
              notifeeService.showStatusUpdateNotification(
                post.title,
                message.newFlair
              );
            }
          }
        }
        break;

      case 'SOLVED':
        if (message.postId) {
          updatePostFlair(message.postId, 'Solved');
        }
        break;
    }
  }
}

export const fcmService = new FCMService();
