import React, { useEffect } from 'react';
import { Platform, UIManager, View } from 'react-native';
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

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'help';

          if (route.name === 'Feed') {
            iconName = focused ? 'chat' : 'chat-outline';
          } else if (route.name === 'Bookmarks') {
            iconName = focused ? 'bookmark-multiple' : 'bookmark-multiple-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'cog' : 'cog-outline';
          }

          return (
            <View style={[
              {
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
              },
              focused && { backgroundColor: settings.accentColor }
            ]}>
              <Icon name={iconName} size={size} color={color} />
            </View>
          );
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginBottom: 6,
        },
        tabBarActiveTintColor: '#091117',
        tabBarInactiveTintColor: '#98A1AB',
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          height: 76,
          borderRadius: 28,
          backgroundColor: settings.theme === 'amoled' ? '#111214' : '#17191D',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 10,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      })}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{ tabBarLabel: 'Chats' }}
      />
      <Tab.Screen
        name="Bookmarks"
        component={BookmarksScreen}
        options={{ tabBarLabel: 'Saved' }}
      />
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
