import React, {useEffect} from 'react';
import {NavigationContainer, LinkingOptions} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {FeedScreen} from './src/screens/FeedScreen';
import {BookmarksScreen} from './src/screens/BookmarksScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {useAppStore} from './src/store/useAppStore';
import {fcmService} from './src/services/fcmService';
import {notifeeService} from './src/services/notifeeService';
import {checkAndShowUpdateDialog} from './src/services/updateService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Deep linking configuration
const linking: LinkingOptions<any> = {
  prefixes: ['wizardleads://'],
  config: {
    screens: {
      Feed: {
        screens: {
          PostDetails: 'post/:postId',
        },
      },
    },
  },
};

function TabNavigator() {
  const {settings} = useAppStore();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          if (route.name === 'Feed') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Bookmarks') {
            iconName = focused ? 'bookmark' : 'bookmark-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'cog' : 'cog-outline';
          } else {
            iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: settings.accentColor,
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: {
          backgroundColor: settings.theme === 'amoled' ? '#000000' : '#121212',
          borderTopColor: '#2A2A2A',
        },
        headerStyle: {
          backgroundColor: settings.theme === 'amoled' ? '#000000' : '#121212',
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
  const {settings, clearExpiredPosts} = useAppStore();

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
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
