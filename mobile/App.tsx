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
          backgroundColor: settings.theme === 'amoled' ? '#000000' : '#0A0A0A',
          height: 88,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerBackground: () => (
          <View pointerEvents="none" style={styles.headerBackgroundWrap}>
            <View
              style={[
                styles.headerSurface,
                {
                  backgroundColor: settings.theme === 'amoled' ? '#17191D' : '#232428',
                },
              ]}
            />
          </View>
        ),
        headerTitleContainerStyle: {
          left: 40,
          right: 40,
        },
        headerLeftContainerStyle: {
          paddingLeft: 8,
        },
        headerRightContainerStyle: {
          paddingRight: 8,
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

  useEffect(() => {
    let unsubscribeForegroundMessages: (() => void) | undefined;

    const askInstalledAppsAccess = async (): Promise<void> => {
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Allow App Detection',
          'Allow Reddif to detect installed apps so links can open directly in supported apps (like Reddit).',
          [
            {
              text: 'Deny',
              style: 'cancel',
              onPress: async () => {
                await setInstalledAppsAccessAllowed(false);
                resolve();
              },
            },
            {
              text: 'Allow',
              onPress: async () => {
                await setInstalledAppsAccessAllowed(true);
                resolve();
              },
            },
          ]
        );
      });
    };

    const runInitialPermissionPrompts = async (): Promise<void> => {
      const alreadyShown = await hasShownInitialPermissionPrompt();
      const notificationChoice = await getNotificationPermissionChoice();
      if (alreadyShown) {
        if (notificationChoice === 'allowed') {
          await fcmService.requestPermission();
        }
        return;
      }

      await new Promise<void>((resolve) => {
        Alert.alert(
          'Allow Notifications',
          'Enable notifications so Reddif can alert you about new posts and flair updates.',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: async () => {
                await setNotificationPermissionChoice('deferred');
                resolve();
              },
            },
            {
              text: 'Allow',
              onPress: async () => {
                await setNotificationPermissionChoice('allowed');
                await fcmService.requestPermission();
                resolve();
              },
            },
          ]
        );
      });
      await askInstalledAppsAccess();
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
      if (unsubscribeForegroundMessages) {
        unsubscribeForegroundMessages();
      }
      fcmService.unsubscribeFromAllTopics();
    };
  }, []);

  useEffect(() => {
    // Re-subscribe to topics when notification settings change
    fcmService.subscribeToTopics();
  }, [settings.notifToggles]);

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerBackgroundWrap: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerSurface: {
    flex: 1,
    borderRadius: 18,
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
