import type { NavigatorScreenParams } from '@react-navigation/native';

export type PatientTabParamList = {
  PatientHome: undefined;
  PatientAppointments: undefined;
  PatientAnnouncements: undefined;
};

export type MainTabParamList = PatientTabParamList;

export type PatientRootStackParamList = {
  Login: undefined;
  Signup: undefined;
  PatientMain: NavigatorScreenParams<PatientTabParamList> | undefined;
  Chat: {
    patientId: number;
    doctorId: number;
    patientName: string;
    profilePicUrl?: string | null;
  };
  PatientProfile: undefined;
};

export type RootStackParamList = PatientRootStackParamList;
