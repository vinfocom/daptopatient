import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, ShieldCheck, Stethoscope, Mail, RefreshCw, Calculator, Check } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { getLoginChallenge, patientLogin, savePatientPushToken, verifyLoginChallenge } from '../api/auth';
import { setAuthSession } from '../api/token';
import { useAuthSession } from '../context/AuthSessionContext';
import { registerForPushNotificationsAsync } from '../hooks/usePushNotifications';
import type { PatientRootStackParamList } from '../navigation/types';

type LoginScreenNavigationProp = NativeStackNavigationProp<PatientRootStackParamList, 'Login'>;

async function registerPatientPushToken(authToken?: string) {
  try {
    const pushToken = await registerForPushNotificationsAsync();
    if (!pushToken?.data) return;
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
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [challengeQuestion, setChallengeQuestion] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeVerificationToken, setChallengeVerificationToken] = useState('');
  const [challengeVerified, setChallengeVerified] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [verifyingChallenge, setVerifyingChallenge] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<'idle' | 'success'>('idle');
  const [answerInputActive, setAnswerInputActive] = useState(false);

  const canAttemptLogin = useMemo(
    () => Boolean(identifier.trim() && challengeAnswer.trim() && challengeVerified),
    [challengeAnswer, challengeVerified, identifier]
  );

  const loadLoginChallenge = async (clearAnswer = true) => {
    setChallengeLoading(true);
    setChallengeVerified(false);
    setChallengeVerificationToken('');
    setChallengeStatus('idle');
    try {
      const challenge = await getLoginChallenge();
      setChallengeQuestion(challenge.question);
      setChallengeId(challenge.challengeId);
      if (clearAnswer) {
        setChallengeAnswer('');
        setAnswerInputActive(false);
      }
    } catch {
      setChallengeQuestion('');
      setChallengeId('');
    } finally {
      setChallengeLoading(false);
    }
  };

  const handleVerifyChallenge = async (answer: string) => {
    if (!challengeId || !answer.trim() || challengeVerified) return;

    setVerifyingChallenge(true);
    setChallengeVerified(false);
    setChallengeVerificationToken('');
    setChallengeStatus('idle');

    try {
      const response = await verifyLoginChallenge(challengeId, answer.trim());
      setChallengeVerificationToken(response?.verificationToken || '');
      setChallengeVerified(true);
      setChallengeStatus('success');
    } catch {
      setChallengeVerified(false);
    } finally {
      setVerifyingChallenge(false);
    }
  };

  useEffect(() => {
    void loadLoginChallenge();
  }, []);

  useEffect(() => {
    if (challengeVerified) {
      setChallengeVerified(false);
      setChallengeVerificationToken('');
      setChallengeStatus('idle');
    }
  }, [challengeAnswer]);

  useEffect(() => {
    if (!challengeAnswer.trim() || !challengeId || challengeLoading || challengeVerified) return;

    const timer = setTimeout(() => {
      void handleVerifyChallenge(challengeAnswer);
    }, 250);

    return () => clearTimeout(timer);
  }, [challengeAnswer, challengeId, challengeLoading, challengeVerified]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (!identifier.trim()) {
        Alert.alert('Error', 'Please enter phone number or Telegram chat ID');
        return;
      }

      if (!challengeId || !challengeVerified || !challengeVerificationToken) {
        Alert.alert('Verification Required', 'Please solve and verify the calculation before logging in.');
        return;
      }

      const response = await patientLogin(identifier.trim(), challengeId, challengeVerificationToken);
      if (!response?.token || (response?.patient?.role && response.patient.role !== 'PATIENT')) {
        Alert.alert('Error', 'Login failed: Invalid patient session');
        return;
      }

      await setAuthSession(response.token, 'PATIENT');
      await registerPatientPushToken(response.token);
      await refreshSession();
      navigation.replace('PatientMain');
    } catch (error: any) {
      const status = error?.response?.status;
      let message = error?.response?.data?.error || 'Login failed. Please check your credentials and try again.';

      if (status === 400) {
        setChallengeVerified(false);
        await loadLoginChallenge();
        message = error?.response?.data?.error || 'Verification expired. Please solve the new calculation and try again.';
      }

      if (status === 404) {
        message = 'Patient not found. Please check your phone number or Telegram chat ID.';
      } else if (status === 401) {
        message = 'Invalid phone number or Telegram chat ID.';
      } else if (status === 500) {
        message = 'Server error. Please try again later.';
      } else if (!status) {
        message = 'Network error. Please check your internet connection.';
      }

      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-700" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              entering={FadeInDown.duration(600).springify()}
              className="bg-blue-700 items-center px-8 pt-12 pb-16"
            >
              <View className="w-24 h-24 rounded-full bg-white items-center justify-center mb-5 shadow-lg">
                <Stethoscope size={48} color="#1d4ed8" />
              </View>

              <Text className="text-white text-4xl font-extrabold tracking-wide mb-2">
                Patient Portal
              </Text>
              <Text className="text-blue-200 text-base text-center">
                Sign in to view appointments, chat, and announcements
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(200).duration(500)}
              className="flex-1 bg-gray-50 px-7 pt-9 pb-10 -mt-7"
              style={{ borderTopLeftRadius: 36, borderTopRightRadius: 36 }}
            >
              <View className="items-center mb-8">
                <Text className="text-3xl font-extrabold text-slate-800 mb-2">
                  Welcome Back
                </Text>
                <Text className="text-base text-slate-400 text-center">
                  Enter your patient identifier to continue
                </Text>
              </View>

              <View className="bg-white border border-gray-200 rounded-2xl p-1 mb-5 flex-row">
                <View className="flex-1 py-2 rounded-xl bg-blue-600">
                  <Text className="text-center font-semibold text-white">Patient</Text>
                </View>
              </View>

              <View className="mb-8">
                <Text className="text-base font-bold text-gray-700 mb-2 ml-1">
                  Phone or Telegram Chat ID
                </Text>
                <View
                  className={`flex-row items-center bg-white rounded-2xl px-4 border-2 ${
                    identifierFocused ? 'border-blue-500' : 'border-gray-200'
                  }`}
                  style={{
                    shadowColor: identifierFocused ? '#2563eb' : '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: identifierFocused ? 0.15 : 0.04,
                    shadowRadius: 6,
                    elevation: identifierFocused ? 4 : 1,
                  }}
                >
                  <Mail size={20} color="#64748b" />
                  <TextInput
                    className="flex-1 py-5 px-3 text-base text-slate-800"
                    placeholder="e.g. 9392569600 or 123456789"
                    placeholderTextColor="#9ca3af"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    onFocus={() => setIdentifierFocused(true)}
                    onBlur={() => setIdentifierFocused(false)}
                  />
                </View>
              </View>

              <View className="mb-2">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-gray-700 ml-1">
                    Quick Verification
                  </Text>
                  <TouchableOpacity
                    onPress={() => void loadLoginChallenge()}
                    disabled={challengeLoading || verifyingChallenge}
                    className="flex-row items-center"
                  >
                    <RefreshCw size={14} color="#2563eb" />
                  </TouchableOpacity>
                </View>

                <View className="bg-white border border-blue-100 rounded-2xl px-4 py-3 mb-3">
                  <View className="flex-row items-center pl-5">
                    <Calculator size={24} color="#2563eb" />
                    {challengeLoading ? (
                      <Text className="text-slate-800 font-bold text-2xl ml-3">
                        Loading calculation...
                      </Text>
                    ) : challengeQuestion ? (
                      <>
                        <Text className="text-slate-800 font-bold text-[28px] ml-4 mr-1">
                          {challengeQuestion.replace('?', '')}
                        </Text>
                        {challengeAnswer === '' && !answerInputActive && !challengeVerified ? (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setAnswerInputActive(true)}
                            className="w-[112px] h-[56px] bg-white items-center justify-center ml-5 mr-1 px-2 rounded-2xl border border-blue-200"
                          >
                            <Text className="text-[28px] font-bold text-gray-400">?</Text>
                          </TouchableOpacity>
                        ) : (
                          <TextInput
                            autoFocus={answerInputActive && !challengeVerified}
                            className="w-[112px] h-[56px] bg-white text-center text-[28px] font-bold text-slate-800 ml-5 mr-1 px-2 rounded-2xl border border-blue-200"
                            placeholder="?"
                            placeholderTextColor="#9ca3af"
                            value={challengeAnswer}
                            onChangeText={(text) => {
                              setChallengeAnswer(text);
                              if (text === '' && !challengeVerified) {
                                setAnswerInputActive(false);
                              }
                            }}
                            onBlur={() => {
                              if (!challengeAnswer && !challengeVerified) {
                                setAnswerInputActive(false);
                              }
                            }}
                            keyboardType="number-pad"
                            maxLength={4}
                            editable={!challengeLoading && !challengeVerified}
                            style={{ textAlign: 'center', lineHeight: 32 }}
                          />
                        )}
                      </>
                    ) : (
                      <Text className="text-slate-800 font-bold text-2xl ml-3">
                        Calculation unavailable
                      </Text>
                    )}
                    <View className="ml-1 w-9 h-9 items-center justify-center">
                      {verifyingChallenge ? (
                        <ActivityIndicator color="#2563eb" size="small" />
                      ) : challengeStatus === 'success' ? (
                        <Animated.View
                          entering={ZoomIn.duration(220)}
                          className="w-9 h-9 rounded-xl bg-emerald-500 items-center justify-center"
                        >
                          <Check size={18} color="#fff" />
                        </Animated.View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading || !canAttemptLogin}
                activeOpacity={0.8}
                className={`rounded-2xl py-5 items-center justify-center ${
                  loading || !canAttemptLogin ? 'bg-blue-300' : 'bg-blue-600'
                }`}
                style={{
                  shadowColor: '#1d4ed8',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                {loading ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-white font-bold text-lg ml-3">Signing in...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Text className="text-white font-extrabold text-lg mr-2 tracking-wide">
                      Sign In as Patient
                    </Text>
                    <ArrowRight size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center justify-center mt-8 px-4">
                <ShieldCheck size={14} color="#9ca3af" />
                <Text className="text-xs text-gray-400 text-center ml-2">
                  Use the same phone number or Telegram chat ID stored in the backend.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
