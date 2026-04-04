import React from 'react';

import { getPatientProfile, savePatientPushToken, type PatientMeUser } from '../api/auth';
import { getRole, getToken, removeToken, setRole as setStoredRole, type AppRole } from '../api/token';
import { registerForPushNotificationsAsync } from '../hooks/usePushNotifications';

type SessionState = {
  role: AppRole | null;
  patient: PatientMeUser | null;
  isLoading: boolean;
  pushTokenSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  pushTokenSyncMessage: string | null;
  refreshSession: () => Promise<void>;
  syncPushToken: () => Promise<{ ok: boolean; message: string }>;
  clearSession: () => Promise<void>;
};

const AuthSessionContext = React.createContext<SessionState | undefined>(undefined);

export function AuthSessionProvider({
  children,
  initialRole,
}: {
  children: React.ReactNode;
  initialRole?: AppRole | null;
}) {
  const [role, setRole] = React.useState<AppRole | null>(initialRole ?? null);
  const [patient, setPatient] = React.useState<PatientMeUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pushTokenSyncStatus, setPushTokenSyncStatus] = React.useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [pushTokenSyncMessage, setPushTokenSyncMessage] = React.useState<string | null>(null);

  const clearSession = React.useCallback(async () => {
    await removeToken();
    setRole(null);
    setPatient(null);
    setIsLoading(false);
    setPushTokenSyncStatus('idle');
    setPushTokenSyncMessage(null);
  }, []);

  const syncPushToken = React.useCallback(async () => {
    const token = await getToken();
    const storedRole = await getRole();

    if (!token || storedRole !== 'PATIENT') {
      setPushTokenSyncStatus('error');
      setPushTokenSyncMessage('No active patient session found');
      return { ok: false, message: 'No active patient session found' };
    }

    setPushTokenSyncStatus('syncing');
    setPushTokenSyncMessage('Requesting notification permission');

    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (!pushToken?.data) {
        setPushTokenSyncStatus('error');
        setPushTokenSyncMessage('Push token was not generated on this device');
        return { ok: false, message: 'Push token was not generated on this device' };
      }

      setPushTokenSyncMessage('Saving token to backend');
      await savePatientPushToken(pushToken.data, token);
      setPushTokenSyncStatus('success');
      setPushTokenSyncMessage('Push token synced successfully');
      return { ok: true, message: 'Push token synced successfully' };
    } catch (error) {
      const maybeError = error as { response?: { data?: { error?: string } }; message?: string };
      const detail =
        maybeError?.response?.data?.error ||
        maybeError?.message ||
        'Failed to sync push token';
      setPushTokenSyncStatus('error');
      setPushTokenSyncMessage(detail);
      return { ok: false, message: detail };
    }
  }, []);

  const refreshSession = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const storedRole = await getRole();

      if (!token || storedRole !== 'PATIENT') {
        await clearSession();
        return;
      }

      const response = await getPatientProfile();
      if (!response.patient) {
        await clearSession();
        return;
      }

      await setStoredRole('PATIENT');
      setRole('PATIENT');
      setPatient({ ...response.patient, role: 'PATIENT' });
      await syncPushToken();
    } catch {
      await clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession, syncPushToken]);

  React.useEffect(() => {
    refreshSession().catch(() => {
      void clearSession();
      setIsLoading(false);
    });
  }, [clearSession, refreshSession]);

  const value = React.useMemo(
    () => ({
      role,
      patient,
      isLoading,
      pushTokenSyncStatus,
      pushTokenSyncMessage,
      refreshSession,
      syncPushToken,
      clearSession,
    }),
    [clearSession, isLoading, patient, pushTokenSyncMessage, pushTokenSyncStatus, refreshSession, role, syncPushToken]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = React.useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within an AuthSessionProvider');
  }
  return context;
}
