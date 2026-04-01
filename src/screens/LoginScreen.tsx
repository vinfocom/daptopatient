import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { patientLogin, savePatientPushToken } from '../api/auth';
import { setAuthSession } from '../api/token';
import { useAuthSession } from '../context/AuthSessionContext';
import { registerForPushNotificationsAsync } from '../hooks/usePushNotifications';
import type { PatientRootStackParamList } from '../navigation/types';

type LoginScreenNavigationProp = NativeStackNavigationProp<PatientRootStackParamList, 'Login'>;

async function registerPatientPushToken(authToken?: string) {
  try {
    const pushToken = await registerForPushNotificationsAsync();
    if (!pushToken?.data) {
      return;
    }
    await savePatientPushToken(pushToken.data, authToken);
  } catch (error) {
    if (__DEV__) {
      console.warn('[push] patient login flow failed to sync push token', error);
    }
  }
}

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { refreshSession } = useAuthSession();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert('Missing field', 'Please enter your patient login identifier.');
      return;
    }

    setLoading(true);
    try {
      const response = await patientLogin(identifier.trim());
      if (!response?.token || (response?.patient && response.patient.role && response.patient.role !== 'PATIENT')) {
        Alert.alert('Login failed', 'This app supports only patient accounts.');
        return;
      }

      await setAuthSession(response.token, 'PATIENT');
      await registerPatientPushToken(response.token);
      await refreshSession();
      navigation.replace('PatientMain');
    } catch (error: any) {
      const status = error?.response?.status;
      let message = error?.response?.data?.error || 'Login failed. Please try again.';

      if (status === 400 || status === 401 || status === 404) {
        message = 'Invalid patient identifier.';
      } else if (status === 500) {
        message = 'Server error. Please try again later.';
      } else if (!status) {
        message = 'Network error. Please check your internet connection.';
      }

      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>Dapto Patient</Text>
          <Text style={styles.subtitle}>Patient portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.description}>
            This app accepts only patient accounts.
          </Text>

          <TextInput
            autoCapitalize="none"
            placeholder="Phone or patient identifier"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
          />

          <Pressable disabled={loading} onPress={handleLogin} style={({ pressed }) => [styles.button, pressed && !loading ? styles.buttonPressed : null]}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Continue to patient app</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ecfeff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  header: {
    gap: 6,
  },
  brand: {
    color: '#0f766e',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
