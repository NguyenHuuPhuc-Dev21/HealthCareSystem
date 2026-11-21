import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './src/App';
import { handleBackgroundMessage } from './src/lib/push';

// Firebase background message handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  await handleBackgroundMessage(remoteMessage);
});

// Notifee background event handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    // Handled on app open
  }
});

AppRegistry.registerComponent('NurseApp', () => App);


