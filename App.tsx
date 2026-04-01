import './src/global.css';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type * as NotificationsType from 'expo-notifications';
import Constants from 'expo-constants';

import { getPatientProfile } from './src/api/auth';
import {
  getPatientUnreadDoctorIdFromNotification,
  parsePatientNotificationTarget,
} from './src/api/notifications';
import { getRole, getToken, removeToken, type AppRole } from './src/api/token';
import { AuthSessionProvider } from './src/context/AuthSessionContext';
import {
  incrementPatientAnnouncementsUnread,
  incrementPatientDoctorUnreadCount,
} from './src/lib/mobileNotificationState';
import AppNavigator from './src/navigation';
import type { PatientRootStackParamList } from './src/navigation/types';

const isExpoGo = Constants.appOwnership === 'expo';
const Notifications: typeof NotificationsType | null = isExpoGo
  ? null
  : require('expo-notifications');

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const navigationRef = createNavigationContainerRef<PatientRootStackParamList>();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState<keyof PatientRootStackParamList>('Login');
  const [bootRole, setBootRole] = useState<AppRole | null>(null);
  const [pendingNotificationData, setPendingNotificationData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token: string | null = null;
      let role: AppRole | null = null;

      try {
        token = await getToken();
        role = await getRole();

        if (token && role === 'PATIENT') {
          await getPatientProfile();
          setInitialRouteName('PatientMain');
        } else {
          token = null;
          role = null;
          await removeToken();
        }
      } catch {
        token = null;
        role = null;
        await removeToken();
      }

      if (!token || !role) {
        setInitialRouteName('Login');
      }

      setBootRole(role);
      setIsLoading(false);
    };

    bootstrapAsync().catch(() => {
      setInitialRouteName('Login');
      setBootRole(null);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!Notifications || !bootRole) return;

    const openPatientNotification = (data?: Record<string, unknown> | null) => {
      const target = parsePatientNotificationTarget(data);
      if (!target) return;

      if (!navigationRef.isReady()) {
        setPendingNotificationData(data || null);
        return;
      }

      if (target.kind === 'announcement') {
        navigationRef.navigate('PatientMain', {
          screen: 'PatientAnnouncements',
        });
        setPendingNotificationData(null);
        return;
      }

      navigationRef.navigate('Chat', {
        patientId: target.patientId,
        doctorId: target.doctorId,
        patientName: target.doctorName,
        profilePicUrl: target.profilePicUrl || null,
      });
      setPendingNotificationData(null);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        openPatientNotification(response?.notification.request.content.data as Record<string, unknown> | undefined);
      })
      .catch(() => undefined);

    const receiveSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const unreadDoctorId = getPatientUnreadDoctorIdFromNotification(data);
      if (data?.type === 'announcement') {
        incrementPatientAnnouncementsUnread(1);
      } else if (unreadDoctorId) {
        incrementPatientDoctorUnreadCount(unreadDoctorId, 1);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openPatientNotification(response.notification.request.content.data as Record<string, unknown> | undefined);
    });

    return () => {
      receiveSubscription.remove();
      responseSubscription.remove();
    };
  }, [bootRole]);

  useEffect(() => {
    if (!bootRole || !pendingNotificationData || !navigationRef.isReady()) return;

    const target = parsePatientNotificationTarget(pendingNotificationData);
    if (!target) return;

    if (target.kind === 'announcement') {
      navigationRef.navigate('PatientMain', {
        screen: 'PatientAnnouncements',
      });
      setPendingNotificationData(null);
      return;
    }

    navigationRef.navigate('Chat', {
      patientId: target.patientId,
      doctorId: target.doctorId,
      patientName: target.doctorName,
      profilePicUrl: target.profilePicUrl || null,
    });
    setPendingNotificationData(null);
  }, [bootRole, pendingNotificationData]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthSessionProvider initialRole={bootRole}>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator initialRouteName={initialRouteName} />
        </NavigationContainer>
      </AuthSessionProvider>
    </GestureHandlerRootView>
  );
}
