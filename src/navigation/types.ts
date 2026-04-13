import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CareSpecializationId } from '../config/careMappings';

export type PatientTabParamList = {
  PatientHome:
    | {
        clearSpecializationSelection?: boolean;
      }
    | undefined;
  PatientAppointments:
    | {
        bookingIntent?: {
          source: "specialization";
          returnTo?: "home";
          specializationId?: CareSpecializationId;
          specializationLabel: string;
          specializationQuery: string;
        };
        appointmentAction?: {
          mode: "reschedule";
          appointmentId: number;
        };
      }
    | undefined;
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
