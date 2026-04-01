import type { AxiosRequestConfig } from 'axios';
import client from './client';
import type { AppRole } from './token';

export interface PatientMeUser {
  patient_id?: number;
  full_name?: string | null;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  role?: AppRole;
}

export interface PatientProfileResponse {
  patient: PatientMeUser | null;
  doctors?: Array<{
    doctor_id: number;
    doctor_name?: string | null;
    specialization?: string | null;
    phone?: string | null;
    profile_pic_url?: string | null;
    relation_type?: 'SELF' | 'OTHER';
  }>;
  linked_profiles?: Array<{
    profile_type?: string | null;
    full_name?: string | null;
  }>;
}

export const patientLogin = async (identifier: string) => {
  const response = await client.post('/patient-auth/login', { identifier });
  return response.data;
};

export const getPatientProfile = async (): Promise<PatientProfileResponse> => {
  const response = await client.get('/patient/me');
  return response.data;
};

export const updatePatientProfile = async (
  data: {
    full_name?: string;
    phone?: string;
    age?: number | string;
    gender?: string;
    push_token?: string;
  },
  authToken?: string
) => {
  const config: AxiosRequestConfig | undefined = authToken
    ? {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    : undefined;

  const response = await client.patch('/patient/me', data, config);
  return response.data;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getErrorDetails(error: unknown) {
  const maybeError = error as {
    response?: {
      status?: number;
      data?: unknown;
    };
    message?: string;
  };

  return {
    status: maybeError?.response?.status ?? null,
    data: maybeError?.response?.data ?? null,
    message: maybeError?.message ?? 'unknown error',
  };
}

async function savePatientPushTokenWithRetry(pushToken: string, authToken?: string) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (__DEV__) {
        console.log(`[push] patient push token save attempt ${attempt}/${maxAttempts}`);
      }

      await updatePatientProfile({ push_token: pushToken }, authToken);

      if (__DEV__) {
        console.log('[push] patient push token saved successfully');
      }
      return;
    } catch (error) {
      const details = getErrorDetails(error);
      if (__DEV__) {
        console.log(`[push] patient push token save attempt ${attempt} failed`, details);
      }
      console.warn('[push] patient push token save failed', details);

      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(attempt * 750);
    }
  }
}

export const savePatientPushToken = async (pushToken: string, authToken?: string) => {
  await savePatientPushTokenWithRetry(pushToken, authToken);
};
