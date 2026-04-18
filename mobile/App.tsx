import React, { useEffect } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { FeedScreen } from './src/screens/FeedScreen';
import { BookmarksScreen } from './src/screens/BookmarksScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useAppStore } from './src/store/useAppStore';
import { fcmService } from './src/services/fcmService';
import { notifeeService } from './src/services/notifeeService';
import {
  checkForUpdates,
  openReleasesPage,
  refreshUpdateAvailability,
  UpdateInfo,
} from './src/services/updateService';
import {
  getNotificationPermissionChoice,
  hasShownInitialPermissionPrompt,
  setInstalledAppsAccessForSession,
  setNotificationPermissionChoice,
  setInitialPermissionPromptShown,
  setInstalledAppsAccessAllowed,
} from './src/services/permissionPrefs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Deep linking configuration - kept for potential future use
// TODO: Add PostDetails screen if deep linking is needed
const linking: LinkingOptions<any> = {
  prefixes: ['wizardleads://'],
  config: {
    screens: {
      Feed: 'feed',
      Bookmarks: 'bookmarks',
      Settings: 'settings',
    },
  },
};

function TabNavigator() {
  const { settings } = useAppStore();
  const hasUpdate = useAppStore(state => state.hasUpdateAvailable);
  const [showUpdateModal, setShowUpdateModal] = React.useState(false);
  const [updateInfo, setUpdateInfo] = React.useState<UpdateInfo | null>(null);

  const openUpdateModal = async () => {
    const info = await checkForUpdates();
    if (!info) {
      useAppStore.getState().setHasUpdateAvailable(false);
      return;
    }
    setUpdateInfo(info);
    setShowUpdateModal(true);
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
        headerTitle: 'Reddif',
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontSize: 24,
          fontWeight: 'bold',
          letterSpacing: -0.5,
        },
        headerRight: () => {
          if (!hasUpdate) return null;
          return (
            <TouchableOpacity
              onPress={openUpdateModal}
              style={{
                marginRight: 16,
                backgroundColor: settings.accentColor + '26',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 36,
              }}
            >
              <Icon name="update" size={18} color={settings.accentColor} style={{ marginRight: 6 }} />
              <Text style={{ color: settings.accentColor, fontWeight: 'bold' }}>Update App</Text>
            </TouchableOpacity>
          );
        },
        tabBarShowIcon: false,
        tabBarLabel: ({ focused, color, children }) => (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              marginBottom: 2,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 18,
              color,
              backgroundColor: focused ? settings.accentColor + '18' : 'transparent',
              overflow: 'hidden',
            }}
          >
            {children}
          </Text>
        ),
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '700',
        },
        tabBarActiveTintColor: settings.accentColor,
        tabBarInactiveTintColor: '#98A1AB',
        tabBarStyle: {
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 14,
          height: 58,
          borderRadius: 18,
          backgroundColor: settings.theme === 'amoled' ? '#17191D' : '#232428',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerStyle: {
          backgroundColor: settings.theme === 'amoled' ? '#000000' : '#121212',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#FFFFFF',
        })}
      >
        <Tab.Screen name="Feed" component={FeedScreen} />
        <Tab.Screen name="Bookmarks" component={BookmarksScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>

      <Modal
        visible={showUpdateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{updateInfo?.isMandatory ? 'Update Required' : 'Update Available'}</Text>
            <Text style={styles.modalSubtitle}>v{updateInfo?.latestVersion}</Text>
            <Text style={styles.modalNotes} numberOfLines={6}>
              {updateInfo?.releaseNotes || 'Bug fixes and improvements'}
            </Text>

            <View style={styles.modalActions}>
              {!updateInfo?.isMandatory ? (
                <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowUpdateModal(false)}>
                  <Text style={styles.cancelButtonText}>Later</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: settings.accentColor },
                  updateInfo?.isMandatory ? styles.fullWidthButton : null,
                ]}
                onPress={async () => {
                  try {
                    setShowUpdateModal(false);
                    await openReleasesPage();
                  } catch (error) {
                    Alert.alert('Update Error', 'Unable to open the update link. Please try again.');
                  }
                }}
              >
                <Text style={styles.saveButtonText}>Update Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function App(): JSX.Element {
  const { settings, clearExpiredPosts } = useAppStore();
  const [permissionPrompt, setPermissionPrompt] = React.useState<'notifications' | 'installedApps' | null>(null);
  const permissionResolverRef = React.useRef<((value: string) => void) | null>(null);

  const askPermissionChoice = React.useCallback(
    (promptType: 'notifications' | 'installedApps'): Promise<string> => {
      return new Promise((resolve) => {
        permissionResolverRef.current = resolve;
        setPermissionPrompt(promptType);
      });
    },
    []
  );

  const resolvePermissionChoice = React.useCallback((choice: string) => {
    setPermissionPrompt(null);
    const resolver = permissionResolverRef.current;
    permissionResolverRef.current = null;
    if (resolver) {
      resolver(choice);
    }
  }, []);

  useEffect(() => {
    let unsubscribeForegroundMessages: (() => void) | undefined;

    const runInitialPermissionPrompts = async (): Promise<void> => {
      const alreadyShown = await hasShownInitialPermissionPrompt();
      const notificationChoice = await getNotificationPermissionChoice();
      if (alreadyShown) {
        if (notificationChoice === 'allowed') {
          await fcmService.requestPermission();
        }
        return;
      }

      const notificationAction = await askPermissionChoice('notifications');
      if (notificationAction === 'allow') {
        const granted = await fcmService.requestPermission();
        await setNotificationPermissionChoice(granted ? 'allowed' : 'deferred');
      } else if (notificationAction === 'once') {
        const granted = await fcmService.requestPermission();
        await setNotificationPermissionChoice(granted ? 'allowed' : 'deferred');
      } else {
        await setNotificationPermissionChoice('deferred');
      }

      const appAccessAction = await askPermissionChoice('installedApps');
      if (appAccessAction === 'allow') {
        await setInstalledAppsAccessAllowed(true);
        setInstalledAppsAccessForSession(true);
      } else if (appAccessAction === 'once') {
        await setInstalledAppsAccessAllowed(false);
        setInstalledAppsAccessForSession(true);
      } else {
        await setInstalledAppsAccessAllowed(false);
        setInstalledAppsAccessForSession(false);
      }
      await setInitialPermissionPromptShown();
    };

    // Initialize FCM
    const initFCM = async () => {
      await runInitialPermissionPrompts();
      await fcmService.subscribeToTopics();
      unsubscribeForegroundMessages = fcmService.setupMessageHandlers();
      await notifeeService.createChannel();
    };

    initFCM();

    // Clear expired posts on startup
    clearExpiredPosts();

    // Check for updates on app start
    refreshUpdateAvailability();

    return () => {
      permissionResolverRef.current = null;
      if (unsubscribeForegroundMessages) {
        unsubscribeForegroundMessages();
      }
      fcmService.unsubscribeFromAllTopics();
    };
  }, [askPermissionChoice]);

  useEffect(() => {
    // Re-subscribe to topics when notification settings change
    fcmService.subscribeToTopics();
  }, [settings.notifToggles]);

  return (
    <>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
        </Stack.Navigator>
      </NavigationContainer>

      <Modal
        visible={permissionPrompt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => resolvePermissionChoice('deny')}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionSheet}>
            <View style={styles.permissionIconWrap}>
              <Icon
                name={permissionPrompt === 'notifications' ? 'bell-outline' : 'apps'}
                size={20}
                color="#E7E7EA"
              />
            </View>

            <Text style={styles.permissionTitle}>
              {permissionPrompt === 'notifications'
                ? 'Allow Reddif to send notifications?'
                : 'Allow Reddif to access installed apps?'}
            </Text>

            {permissionPrompt === 'notifications' ? (
              <>
                <TouchableOpacity
                  style={[styles.permissionButton, styles.permissionPrimaryButton]}
                  onPress={() => resolvePermissionChoice('allow')}
                >
                  <Text style={styles.permissionPrimaryText}>Allow only while using the app</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.permissionButton, styles.permissionSecondaryButton]}
                  onPress={() => resolvePermissionChoice('deny')}
                >
                  <Text style={styles.permissionSecondaryText}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.permissionButton, styles.permissionSecondaryButton]}
                  onPress={() => resolvePermissionChoice('once')}
                >
                  <Text style={styles.permissionSecondaryText}>Only this time</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.permissionButton, styles.permissionSecondaryButton]}
                  onPress={() => resolvePermissionChoice('deny')}
                >
                  <Text style={styles.permissionSecondaryText}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.permissionButton, styles.permissionSecondaryButton]}
                  onPress={() => resolvePermissionChoice('once')}
                >
                  <Text style={styles.permissionSecondaryText}>Only this time</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.permissionButton, styles.permissionSecondaryButton]}
                  onPress={() => resolvePermissionChoice('allow')}
                >
                  <Text style={styles.permissionSecondaryText}>Allow all</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  permissionOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  permissionSheet: {
    backgroundColor: '#232427',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#2E3036',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  permissionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#3A3C42',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  permissionTitle: {
    color: '#F2F2F5',
    fontSize: 22,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 30,
    marginBottom: 14,
  },
  permissionButton: {
    width: '100%',
    minHeight: 62,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
  },
  permissionPrimaryButton: {
    backgroundColor: '#4A86FF',
  },
  permissionSecondaryButton: {
    backgroundColor: '#4A4B4F',
  },
  permissionPrimaryText: {
    color: '#EAF1FF',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  permissionSecondaryText: {
    color: '#F0F0F1',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#14171B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2329',
    padding: 18,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#98A1AB',
    marginTop: 4,
    fontSize: 14,
  },
  modalNotes: {
    color: '#D8DEE6',
    marginTop: 12,
    lineHeight: 20,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthButton: {
    flex: 2,
  },
  cancelButton: {
    backgroundColor: '#232830',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default App;
