import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, UIManager } from 'react-native';
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
import { checkAndShowUpdateDialog } from './src/services/updateService';

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

  return (
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
              onPress={checkAndShowUpdateDialog}
              style={{
                marginRight: 16,
                backgroundColor: settings.accentColor + '26',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Icon name="update" size={18} color={settings.accentColor} style={{ marginRight: 4 }} />
              <Text style={{ color: settings.accentColor, fontWeight: 'bold' }}>Update App</Text>
            </TouchableOpacity>
          );
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'help';

          if (route.name === 'Feed') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Bookmarks') {
            iconName = focused ? 'bookmark' : 'bookmark-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'cog' : 'cog-outline';
          }

          return (
            <View style={[
              { paddingVertical: 4, paddingHorizontal: 16, borderRadius: 16 },
              focused && { backgroundColor: settings.accentColor + '26' }
            ]}>
              <Icon name={iconName} size={size} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: settings.accentColor,
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: {
          backgroundColor: settings.theme === 'amoled' ? '#000000' : '#121212',
          borderTopColor: '#2A2A2A',
          elevation: 0,
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
  );
}

function App(): JSX.Element {
  const { settings, clearExpiredPosts } = useAppStore();

  useEffect(() => {
    // Initialize FCM
    const initFCM = async () => {
      await fcmService.requestPermission();
      await fcmService.subscribeToTopics();
      fcmService.setupMessageHandlers();
      await notifeeService.createChannel();
    };

    initFCM();

    // Clear expired posts on startup
    clearExpiredPosts();

    // Check for updates on app start
    checkAndShowUpdateDialog();

    return () => {
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

export default App;
