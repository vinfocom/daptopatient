import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChatScreen from '../screens/ChatScreen';
import LoginScreen from '../screens/LoginScreen';
import PatientTabNavigator from './PatientTabNavigator';
import PatientProfileScreen from '../screens/PatientProfileScreen';
import type { PatientRootStackParamList } from './types';

const Stack = createNativeStackNavigator<PatientRootStackParamList>();

export default function AppNavigator({
  initialRouteName,
}: {
  initialRouteName: keyof PatientRootStackParamList;
}) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="PatientMain" component={PatientTabNavigator} options={{ animation: 'fade' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="PatientProfile"
        component={PatientProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
