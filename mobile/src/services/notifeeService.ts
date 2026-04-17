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
    await notifee.displayNotification({
      title: 'Status Update',
      body: `"${title.slice(0, 50)}..." changed to ${newFlair}`,
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
