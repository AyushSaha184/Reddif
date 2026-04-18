import AsyncStorage from '@react-native-async-storage/async-storage';

const INITIAL_PERMISSION_PROMPTED_KEY = '@initial_permission_prompted';
const INSTALLED_APPS_ACCESS_KEY = '@installed_apps_access_allowed';
const NOTIFICATION_PERMISSION_CHOICE_KEY = '@notification_permission_choice';

type NotificationPermissionChoice = 'allowed' | 'deferred';

export const hasShownInitialPermissionPrompt = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(INITIAL_PERMISSION_PROMPTED_KEY);
  return value === 'true';
};

export const setInitialPermissionPromptShown = async (): Promise<void> => {
  await AsyncStorage.setItem(INITIAL_PERMISSION_PROMPTED_KEY, 'true');
};

export const isInstalledAppsAccessAllowed = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(INSTALLED_APPS_ACCESS_KEY);
  return value === 'true';
};

export const setInstalledAppsAccessAllowed = async (allowed: boolean): Promise<void> => {
  await AsyncStorage.setItem(INSTALLED_APPS_ACCESS_KEY, allowed ? 'true' : 'false');
};

export const getNotificationPermissionChoice = async (): Promise<NotificationPermissionChoice | null> => {
  const value = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_CHOICE_KEY);
  if (value === 'allowed' || value === 'deferred') {
    return value;
  }
  return null;
};

export const setNotificationPermissionChoice = async (
  choice: NotificationPermissionChoice
): Promise<void> => {
  await AsyncStorage.setItem(NOTIFICATION_PERMISSION_CHOICE_KEY, choice);
};
