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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, ShieldCheck, Stethoscope, Mail, RefreshCw, Calculator, Check, UserPlus, Eye, EyeOff } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { checkPatientLoginAvailability, getLoginChallenge, patientLogin, resetPatientPassword, savePatientPushToken, verifyLoginChallenge } from '../api/auth';
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
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth, fontScale } = useWindowDimensions();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { refreshSession } = useAuthSession();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [challengeQuestion, setChallengeQuestion] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeVerificationToken, setChallengeVerificationToken] = useState('');
  const [challengeVerified, setChallengeVerified] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [verifyingChallenge, setVerifyingChallenge] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<'idle' | 'success'>('idle');
  const [answerInputActive, setAnswerInputActive] = useState(false);

  const isCompactScreen = screenHeight < 760;
  const isVeryCompactScreen = screenHeight < 700;
  const isNarrowScreen = screenWidth < 360;
  const isLargeText = fontScale > 1.15;
  const verificationBoxWidth = isVeryCompactScreen || isNarrowScreen || isLargeText ? 84 : 96;
  const verificationBoxHeight = isVeryCompactScreen || isLargeText ? 52 : 56;
  const verificationFontSize = isVeryCompactScreen || isLargeText ? 24 : 28;

  const canAttemptLogin = useMemo(
    () =>
      Boolean(
        !forgotPasswordMode &&
        phoneChecked &&
        identifier.trim() &&
        challengeAnswer.trim() &&
        (requiresPasswordSetup
          ? newPassword.trim() && confirmPassword.trim()
          : password.trim())
      ),
    [challengeAnswer, confirmPassword, forgotPasswordMode, identifier, newPassword, password, phoneChecked, requiresPasswordSetup]
  );
  const canResetPassword = useMemo(
    () => Boolean(forgotPasswordMode && phoneChecked && identifier.trim() && newPassword.trim() && confirmPassword.trim()),
    [confirmPassword, forgotPasswordMode, identifier, newPassword, phoneChecked]
  );
  const passwordsMatch = useMemo(
    () => Boolean(newPassword.trim() && confirmPassword.trim() && newPassword === confirmPassword),
    [confirmPassword, newPassword]
  );
  const passwordsMismatch = useMemo(
    () => Boolean(confirmPassword.trim() && newPassword !== confirmPassword),
    [confirmPassword, newPassword]
  );

  const resetDetectedFlow = () => {
    setPhoneChecked(false);
    setRequiresPasswordSetup(false);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setChallengeVerified(false);
    setChallengeVerificationToken('');
    setChallengeStatus('idle');
    setChallengeAnswer('');
    setAnswerInputActive(false);
  };

  const switchToForgotPassword = () => {
    setForgotPasswordMode(true);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const switchToLogin = () => {
    setForgotPasswordMode(false);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

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

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleContinueWithPhone = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    setCheckingPhone(true);
    try {
      const result = await checkPatientLoginAvailability(identifier.trim());
      if (!result?.exists) {
        Alert.alert('Patient Not Found', 'Patient not found. Please create an account.');
        return;
      }

      if (forgotPasswordMode) {
        if (!result.hasPassword) {
          Alert.alert('Set Password', 'This account does not have a password yet. Please use the normal set password flow.');
          setForgotPasswordMode(false);
          setRequiresPasswordSetup(true);
          setPhoneChecked(true);
          await loadLoginChallenge();
          return;
        }
        setRequiresPasswordSetup(false);
        setPhoneChecked(true);
        return;
      }

      setRequiresPasswordSetup(!result.hasPassword);
      setPhoneChecked(true);
      setChallengeVerified(false);
      setChallengeVerificationToken('');
      setChallengeStatus('idle');
      setChallengeAnswer('');
      setAnswerInputActive(false);
      await loadLoginChallenge(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        'Unable to check this phone number right now. Please try again.';
      Alert.alert('Unable to Continue', message);
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleForgotPasswordReset = async () => {
    setLoading(true);
    try {
      if (!identifier.trim()) {
        Alert.alert('Error', 'Please enter phone number');
        return;
      }

      if (!newPassword.trim() || !confirmPassword.trim()) {
        Alert.alert('Error', 'Please enter new password and confirm password');
        return;
      }

      if (newPassword.trim().length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Password and confirm password must match');
        return;
      }

      const response = await resetPatientPassword({
        phone: identifier.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
      });

      if (!response?.token) {
        Alert.alert('Error', 'Password reset failed: Invalid patient session');
        return;
      }

      await setAuthSession(response.token, 'PATIENT');
      await registerPatientPushToken(response.token);
      await refreshSession();
      navigation.replace('PatientMain');
    } catch (error: any) {
      const status = error?.response?.status;
      let message = error?.response?.data?.error || 'Unable to reset password right now.';
      if (status === 404) {
        message = 'Patient not found. Please create an account.';
      } else if (status === 500) {
        message = 'Server error. Please try again later.';
      } else if (!status) {
        message = 'Network error. Please check your internet connection.';
      }
      Alert.alert('Reset Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (!identifier.trim()) {
        Alert.alert('Error', 'Please enter phone number');
        return;
      }

      if (!requiresPasswordSetup && !password.trim()) {
        Alert.alert('Error', 'Please enter password');
        return;
      }

      if (requiresPasswordSetup) {
        if (!newPassword.trim() || !confirmPassword.trim()) {
          Alert.alert('Error', 'Please set and confirm your password');
          return;
        }

        if (newPassword.trim().length < 6) {
          Alert.alert('Error', 'Password must be at least 6 characters');
          return;
        }

        if (newPassword !== confirmPassword) {
          Alert.alert('Error', 'Password and confirm password must match');
          return;
        }
      }

      if (!challengeId || !challengeVerified || !challengeVerificationToken) {
        Alert.alert('Verification Required', 'Please solve and verify the calculation before logging in.');
        return;
      }

      const response = await patientLogin(
        identifier.trim(),
        password.trim(),
        challengeId,
        challengeVerificationToken,
        requiresPasswordSetup
          ? {
              setPassword: newPassword.trim(),
              confirmPassword: confirmPassword.trim(),
            }
          : undefined
      );
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
        const responseMessage = error?.response?.data?.error || '';
        if (/calculation|verify/i.test(responseMessage)) {
          setChallengeVerified(false);
          await loadLoginChallenge();
          message = responseMessage || 'Verification expired. Please solve the new calculation and try again.';
        }
      }

      if (status === 404) {
        message = 'Patient not found. Please create an account.';
      } else if (status === 401) {
        message = 'Invalid phone number or password.';
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
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 20, 28),
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          className="bg-gray-50"
          scrollIndicatorInsets={{ bottom: keyboardVisible ? 12 : Math.max(insets.bottom + 20, 28) }}
        >
          <SafeAreaView edges={['top']} className="bg-blue-700">
            <Animated.View
              entering={FadeInDown.duration(600).springify()}
              className={`bg-blue-700 items-center ${
                isNarrowScreen ? 'px-6' : 'px-8'
              } ${
                isVeryCompactScreen ? 'pt-5 pb-8' : isCompactScreen ? 'pt-6 pb-10' : 'pt-8 pb-12'
              }`}
            >
              <View
                className={`rounded-full bg-white items-center justify-center shadow-lg ${
                  isVeryCompactScreen
                    ? 'w-16 h-16 mb-3'
                    : isCompactScreen
                      ? 'w-[72px] h-[72px] mb-3'
                      : 'w-20 h-20 mb-4'
                }`}
              >
                <Stethoscope size={isVeryCompactScreen ? 30 : isCompactScreen ? 34 : 40} color="#1d4ed8" />
              </View>

              <Text
                className={`text-white font-extrabold tracking-wide mb-1 text-center ${
                  isVeryCompactScreen ? 'text-[26px]' : isCompactScreen ? 'text-[28px]' : 'text-[32px]'
                }`}
              >
                Patient Portal
              </Text>
              <Text className={`text-blue-200 text-center ${isVeryCompactScreen ? 'text-xs' : 'text-sm'}`}>
                {forgotPasswordMode ? 'Reset your password and continue' : 'Sign in with phone number and verification'}
              </Text>
            </Animated.View>
          </SafeAreaView>

          <Animated.View
            entering={FadeInUp.delay(200).duration(500)}
            className={`bg-gray-50 ${
              isVeryCompactScreen ? 'px-5 pt-4 pb-4 -mt-4' : isCompactScreen ? 'px-5 pt-5 pb-4 -mt-5' : 'px-6 pt-6 pb-5 -mt-6'
            }`}
            style={{ borderTopLeftRadius: 36, borderTopRightRadius: 36 }}
          >
            <View className={`items-center ${isVeryCompactScreen ? 'mb-3' : isCompactScreen ? 'mb-4' : 'mb-5'}`}>
              <Text
                className={`font-extrabold text-slate-800 mb-1 ${
                  isVeryCompactScreen ? 'text-2xl' : isCompactScreen ? 'text-[26px]' : 'text-[28px]'
                }`}
              >
                Welcome Back
              </Text>
              <Text className={`text-slate-400 text-center ${isVeryCompactScreen ? 'text-xs' : 'text-sm'}`}>
                {!phoneChecked
                  ? forgotPasswordMode
                    ? 'Enter your phone number to reset password'
                    : 'Enter your phone number to continue'
                  : requiresPasswordSetup
                    ? 'Set your password once to continue'
                    : forgotPasswordMode
                      ? 'Enter your new password to continue'
                    : 'Enter your password and verification to continue'}
              </Text>
            </View>

            <View className={`bg-white border border-gray-200 rounded-2xl p-1 flex-row ${isVeryCompactScreen ? 'mb-3' : 'mb-4'}`}>
              <View className="flex-1 py-2 rounded-xl bg-blue-600">
                <Text className="text-center font-semibold text-white">Patient</Text>
              </View>
            </View>

            <View className={isVeryCompactScreen ? 'mb-3.5' : 'mb-4'}>
              <Text className="text-base font-bold text-gray-700 mb-2 ml-1">Phone Number</Text>
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
                  className={`flex-1 px-3 text-base text-slate-800 ${isVeryCompactScreen ? 'py-3.5' : 'py-4'}`}
                  placeholder="e.g. 9392569600"
                  placeholderTextColor="#9ca3af"
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    if (phoneChecked) {
                      resetDetectedFlow();
                    }
                  }}
                  autoCapitalize="none"
                  onFocus={() => setIdentifierFocused(true)}
                  onBlur={() => setIdentifierFocused(false)}
                />
              </View>
            </View>

            {!phoneChecked ? (
              <TouchableOpacity
                onPress={() => {
                  void handleContinueWithPhone();
                }}
                disabled={checkingPhone || !identifier.trim()}
                activeOpacity={0.8}
                className={`rounded-2xl items-center justify-center ${
                  isVeryCompactScreen ? 'py-3.5' : 'py-4'
                } ${checkingPhone || !identifier.trim() ? 'bg-blue-300' : 'bg-blue-600'}`}
                style={{
                  shadowColor: '#1d4ed8',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                {checkingPhone ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#fff" size="small" />
                    <Text
                      className={`text-white font-bold ml-3 ${isVeryCompactScreen || isLargeText ? 'text-base' : 'text-lg'}`}
                      maxFontSizeMultiplier={1.15}
                    >
                      Checking...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Text
                      className={`text-white font-extrabold mr-2 tracking-wide ${
                        isVeryCompactScreen || isLargeText ? 'text-base' : 'text-lg'
                      }`}
                    >
                      Continue
                    </Text>
                    <ArrowRight size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ) : forgotPasswordMode ? (
              <>
                <View className={isVeryCompactScreen ? 'mb-3.5' : 'mb-4'}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-bold text-gray-700 ml-1">New Password</Text>
                    <TouchableOpacity
                      onPress={switchToLogin}
                      activeOpacity={0.8}
                    >
                      <Text className="text-blue-600 font-semibold">Back to Sign In</Text>
                    </TouchableOpacity>
                  </View>
                  <View
                    className={`flex-row items-center bg-white rounded-2xl px-4 border-2 ${
                      newPasswordFocused ? 'border-blue-500' : 'border-gray-200'
                    }`}
                    style={{
                      shadowColor: newPasswordFocused ? '#2563eb' : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: newPasswordFocused ? 0.15 : 0.04,
                      shadowRadius: 6,
                      elevation: newPasswordFocused ? 4 : 1,
                    }}
                  >
                    <Mail size={20} color="#64748b" />
                    <TextInput
                      className={`flex-1 px-3 text-base text-slate-800 ${isVeryCompactScreen ? 'py-3.5' : 'py-4'}`}
                      placeholder="Create a new password"
                      placeholderTextColor="#9ca3af"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                      autoCapitalize="none"
                      onFocus={() => setNewPasswordFocused(true)}
                      onBlur={() => setNewPasswordFocused(false)}
                    />
                    <TouchableOpacity onPress={() => setShowNewPassword((prev) => !prev)} hitSlop={8}>
                      {showNewPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                    </TouchableOpacity>
                  </View>
                </View>

                <View className={isVeryCompactScreen ? 'mb-3.5' : 'mb-4'}>
                  <Text className="text-base font-bold text-gray-700 mb-2 ml-1">Confirm Password</Text>
                  <View
                    className={`flex-row items-center bg-white rounded-2xl px-4 border-2 ${
                      passwordsMatch ? 'border-emerald-400' : passwordsMismatch ? 'border-red-300' : confirmPasswordFocused ? 'border-blue-500' : 'border-gray-200'
                    }`}
                    style={{
                      shadowColor: confirmPasswordFocused ? '#2563eb' : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: confirmPasswordFocused ? 0.15 : 0.04,
                      shadowRadius: 6,
                      elevation: confirmPasswordFocused ? 4 : 1,
                    }}
                  >
                    <Mail size={20} color="#64748b" />
                    <TextInput
                      className={`flex-1 px-3 text-base text-slate-800 ${isVeryCompactScreen ? 'py-3.5' : 'py-4'}`}
                      placeholder="Re-enter your new password"
                      placeholderTextColor="#9ca3af"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      onFocus={() => setConfirmPasswordFocused(true)}
                      onBlur={() => setConfirmPasswordFocused(false)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)} hitSlop={8}>
                      {showConfirmPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : !requiresPasswordSetup ? (
              <View className={isVeryCompactScreen ? 'mb-3.5' : 'mb-4'}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-gray-700 ml-1">Password</Text>
                  <TouchableOpacity
                    onPress={switchToForgotPassword}
                    activeOpacity={0.8}
                  >
                    <Text className="text-blue-600 font-semibold">Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
                <View
                  className={`flex-row items-center bg-white rounded-2xl px-4 border-2 ${
                    passwordFocused ? 'border-blue-500' : 'border-gray-200'
                  }`}
                  style={{
                    shadowColor: passwordFocused ? '#2563eb' : '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: passwordFocused ? 0.15 : 0.04,
                    shadowRadius: 6,
                    elevation: passwordFocused ? 4 : 1,
                  }}
                >
                  <Mail size={20} color="#64748b" />
                  <TextInput
                    className={`flex-1 px-3 text-base text-slate-800 ${isVeryCompactScreen ? 'py-3.5' : 'py-4'}`}
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                    {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View className={isVeryCompactScreen ? 'mb-3.5' : 'mb-4'}>
                  <Text className="text-base font-bold text-gray-700 mb-2 ml-1">Set Password</Text>
                  <View
                    className={`flex-row items-center bg-white rounded-2xl px-4 border-2 ${
                      newPasswordFocused ? 'border-blue-500' : 'border-gray-200'
                    }`}
                    style={{
                      shadowColor: newPasswordFocused ? '#2563eb' : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: newPasswordFocused ? 0.15 : 0.04,
                      shadowRadius: 6,
                      elevation: newPasswordFocused ? 4 : 1,
                    }}
                  >
                    <Mail size={20} color="#64748b" />
                    <TextInput
                      className={`flex-1 px-3 text-base text-slate-800 ${isVeryCompactScreen ? 'py-3.5' : 'py-4'}`}
                      placeholder="Create a password"
                      placeholderTextColor="#9ca3af"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                      autoCapitalize="none"
                      onFocus={() => setNewPasswordFocused(true)}
                      onBlur={() => setNewPasswordFocused(false)}
                    />
                    <TouchableOpacity onPress={() => setShowNewPassword((prev) => !prev)} hitSlop={8}>
                      {showNewPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                    </TouchableOpacity>
                  </View>
                </View>

                <View className={isVeryCompactScreen ? 'mb-3.5' : 'mb-4'}>
                  <Text className="text-base font-bold text-gray-700 mb-2 ml-1">Re-enter Password</Text>
                  <View
                    className={`flex-row items-center bg-white rounded-2xl px-4 border-2 ${
                      passwordsMatch ? 'border-emerald-400' : passwordsMismatch ? 'border-red-300' : confirmPasswordFocused ? 'border-blue-500' : 'border-gray-200'
                    }`}
                    style={{
                      shadowColor: confirmPasswordFocused ? '#2563eb' : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: confirmPasswordFocused ? 0.15 : 0.04,
                      shadowRadius: 6,
                      elevation: confirmPasswordFocused ? 4 : 1,
                    }}
                  >
                    <Mail size={20} color="#64748b" />
                    <TextInput
                      className={`flex-1 px-3 text-base text-slate-800 ${isVeryCompactScreen ? 'py-3.5' : 'py-4'}`}
                      placeholder="Re-enter your password"
                      placeholderTextColor="#9ca3af"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      onFocus={() => setConfirmPasswordFocused(true)}
                      onBlur={() => setConfirmPasswordFocused(false)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)} hitSlop={8}>
                      {showConfirmPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {phoneChecked && !forgotPasswordMode ? (
            <View className="mb-2">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-bold text-gray-700 ml-1">Quick Verification</Text>
                <TouchableOpacity
                  onPress={() => {
                    void loadLoginChallenge();
                  }}
                  disabled={challengeLoading || verifyingChallenge}
                  className="flex-row items-center"
                >
                  <RefreshCw size={14} color="#2563eb" />
                </TouchableOpacity>
              </View>

              <View
                className={`bg-white border border-blue-100 rounded-2xl px-4 ${
                  isVeryCompactScreen ? 'py-2 mb-1.5' : 'py-2.5 mb-2'
                }`}
              >
                <View className="flex-row items-center pl-3">
                  <View className="flex-1 min-w-0 flex-row items-center flex-wrap">
                    <Calculator size={24} color="#2563eb" />
                    {challengeLoading ? (
                      <Text className="text-slate-800 font-bold text-2xl ml-3 shrink">Loading calculation...</Text>
                    ) : challengeQuestion ? (
                      <View className="flex-1 min-w-0 flex-row items-center flex-wrap ml-4">
                        <Text
                          className={`text-slate-800 font-bold mr-2 shrink ${
                            isVeryCompactScreen || isLargeText ? 'text-[24px]' : 'text-[28px]'
                          }`}
                        >
                          {challengeQuestion.replace('?', '')}
                        </Text>
                        {challengeAnswer === '' && !answerInputActive && !challengeVerified ? (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setAnswerInputActive(true)}
                            className="bg-white items-center justify-center ml-2 px-2 rounded-2xl border border-blue-200 shrink-0"
                            style={{ width: verificationBoxWidth, height: verificationBoxHeight }}
                          >
                            <Text className="font-bold text-gray-400" style={{ fontSize: verificationFontSize }}>
                              ?
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TextInput
                            autoFocus={answerInputActive && !challengeVerified}
                            className="bg-white text-center font-bold text-slate-800 ml-2 px-2 rounded-2xl border border-blue-200 shrink-0"
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
                            style={{
                              width: verificationBoxWidth,
                              height: verificationBoxHeight,
                              textAlign: 'center',
                              fontSize: verificationFontSize,
                              lineHeight: verificationFontSize + 4,
                            }}
                          />
                        )}
                      </View>
                    ) : (
                      <Text className="text-slate-800 font-bold text-2xl ml-3 shrink">Calculation unavailable</Text>
                    )}
                  </View>
                  <View className="ml-3 w-9 h-9 items-center justify-center shrink-0">
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
            ) : null}

            {phoneChecked && !forgotPasswordMode ? (
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || !canAttemptLogin}
              activeOpacity={0.8}
              className={`rounded-2xl items-center justify-center ${
                isVeryCompactScreen ? 'py-3.5' : 'py-4'
              } ${loading || !canAttemptLogin ? 'bg-blue-300' : 'bg-blue-600'}`}
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
                  <Text
                    className={`text-white font-bold ml-3 ${isVeryCompactScreen || isLargeText ? 'text-base' : 'text-lg'}`}
                    maxFontSizeMultiplier={1.15}
                  >
                    Signing in...
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Text
                    className={`text-white font-extrabold mr-2 tracking-wide ${
                      isVeryCompactScreen || isLargeText ? 'text-base' : 'text-lg'
                    }`}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    maxFontSizeMultiplier={1.1}
                    style={{ flexShrink: 1, textAlign: 'center' }}
                  >
                    Sign In as Patient
                  </Text>
                  <ArrowRight size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            ) : null}

            {phoneChecked && forgotPasswordMode ? (
            <TouchableOpacity
              onPress={handleForgotPasswordReset}
              disabled={loading || !canResetPassword}
              activeOpacity={0.8}
              className={`rounded-2xl items-center justify-center ${
                isVeryCompactScreen ? 'py-3.5' : 'py-4'
              } ${loading || !canResetPassword ? 'bg-blue-300' : 'bg-blue-600'}`}
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
                  <Text
                    className={`text-white font-bold ml-3 ${isVeryCompactScreen || isLargeText ? 'text-base' : 'text-lg'}`}
                    maxFontSizeMultiplier={1.15}
                  >
                    Resetting...
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Text
                    className={`text-white font-extrabold mr-2 tracking-wide ${
                      isVeryCompactScreen || isLargeText ? 'text-base' : 'text-lg'
                    }`}
                  >
                    Reset Password
                  </Text>
                  <ArrowRight size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.8}
              className={`rounded-2xl items-center justify-center border border-blue-200 bg-white ${
                isVeryCompactScreen ? 'py-3 mt-3' : 'py-3.5 mt-3'
              }`}
            >
              <View className="flex-row items-center">
                <UserPlus size={18} color="#2563eb" />
                <Text className="text-blue-600 font-bold ml-2 text-base">New patient? Create account</Text>
              </View>
            </TouchableOpacity>

            <View className={`px-4 ${isVeryCompactScreen ? 'mt-3' : 'mt-4'}`}>
              <View className="flex-row items-center justify-center">
                <ShieldCheck size={14} color="#9ca3af" />
                <Text className="text-xs text-gray-400 text-center ml-2" maxFontSizeMultiplier={1.2}>
                  Authorized medical personnel only.{'\n'}Your session is encrypted and secure.
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
