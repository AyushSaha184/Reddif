/**
 * @format
 */

import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import {name as appName} from './app.json';
import {handleIncomingFCMData} from './src/services/fcmService';

messaging().setBackgroundMessageHandler(async remoteMessage => {
	await handleIncomingFCMData(remoteMessage?.data, {isBackgroundHandler: true});
});

AppRegistry.registerComponent(appName, () => App);
