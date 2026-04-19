import notifee, {AndroidImportance, AndroidVisibility} from '@notifee/react-native';

class NotifeeService {
  async createChannel(): Promise<string> {
    return await notifee.createChannel({
      id: 'reddit-leads',
      name: 'Reddit Lead Notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibration: true,
      vibrationPattern: [300, 500],
    });
  }

  async showStatusUpdateNotification(title: string, newFlair: string): Promise<void> {
    const shortTitle = title.length > 50 ? `${title.slice(0, 50)}...` : title;
    const body =
      newFlair === 'Solved'
        ? `Bookmarked post is now solved: "${shortTitle}"`
        : `"${shortTitle}" changed to ${newFlair}`;

    await notifee.displayNotification({
      title: 'Status Update',
      body,
      android: {
        channelId: 'reddit-leads',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
    });
  }

  async showNewPostNotification(title: string, flair: string, budget?: string | null): Promise<void> {
    const bodyBudget = budget ? ` • ${budget}` : '';
    await notifee.displayNotification({
      title: `[${flair}] New Post`,
      body: `${title.slice(0, 80)}${bodyBudget}`,
      android: {
        channelId: 'reddit-leads',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
    });
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await notifee.cancelNotification(notificationId);
  }
}

export const notifeeService = new NotifeeService();
