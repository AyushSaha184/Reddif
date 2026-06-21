import React, { useEffect } from 'react';
import {
  AppState,
  AppStateStatus,
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
import { pollingService } from './src/services/pollingService';
import {
  checkForUpdates,
  openReleasesPage,
  refreshUpdateAvailability,
  UpdateInfo,
} from './src/services/updateService';
import {
  hasShownInitialPermissionPrompt,
  setInitialPermissionPromptShown,
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
    const info = await checkForUpdates(true);
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
              style={[styles.updateButton, { backgroundColor: settings.accentColor + '26' }]}
            >
              <View style={styles.updateButtonContent}>
                <Icon name="update" size={18} color={settings.accentColor} />
                <Text style={[styles.updateButtonText, { color: settings.accentColor }]}>Update App</Text>
              </View>
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
            {updateInfo?.releaseNotes ? (
              <Text style={styles.modalNotes} numberOfLines={6}>
                {updateInfo.releaseNotes}
              </Text>
            ) : null}

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
  const lastAppActiveSyncRef = React.useRef(0);

  const syncTopicSubscriptions = React.useCallback(async (reason: string): Promise<void> => {
    try {
      await fcmService.subscribeToTopics();
    } catch (error) {
      console.warn(`Failed to sync FCM topic subscriptions (${reason})`, error);
    }
  }, []);

  useEffect(() => {
    let unsubscribeForegroundMessages: (() => void) | undefined;

    const runInitialPermissionPrompts = async (): Promise<void> => {
      const alreadyShown = await hasShownInitialPermissionPrompt();
      if (alreadyShown) {
        return;
      }

      await fcmService.requestPermission();
      await setInitialPermissionPromptShown();
    };

    // Initialize FCM
    const initFCM = async () => {
      await runInitialPermissionPrompts();
      await syncTopicSubscriptions('init');
      unsubscribeForegroundMessages = fcmService.setupMessageHandlers();
      await notifeeService.createChannel();
    };

    initFCM();

    // Start RSS polling as fallback for FCM
    pollingService.startPolling();

    // Clear expired posts on startup
    clearExpiredPosts();

    // Check for updates on app start
    refreshUpdateAvailability();

    return () => {
      if (unsubscribeForegroundMessages) {
        unsubscribeForegroundMessages();
      }
      pollingService.stopPolling();
    };
  }, [syncTopicSubscriptions]);

  useEffect(() => {
    // Re-subscribe to topics when notification settings change
    syncTopicSubscriptions('settings-change');
  }, [settings.notifToggles, syncTopicSubscriptions]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          const now = Date.now();
          if (now - lastAppActiveSyncRef.current < 5 * 60 * 1000) {
            return;
          }
          lastAppActiveSyncRef.current = now;
          syncTopicSubscriptions('app-active');
        }
      }
    );

    return () => {
      appStateSubscription.remove();
    };
  }, [syncTopicSubscriptions]);

  return (
    <>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  updateButton: {
    marginRight: 16,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  updateButtonText: {
    fontWeight: '700',
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
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
