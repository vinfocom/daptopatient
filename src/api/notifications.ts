import client from './client';

export interface IncomingNotificationMessage {
    senderName: string;
    senderRole: 'DOCTOR' | 'PATIENT';
    preview: string;
    isAnnouncement?: boolean;
    createdAt: string;
    patientId: number;
    doctorId: number;
}

export interface ChatNotificationsResponse {
    count: number;
    announcementCount: number;
    latestAt: string | null;
    latestMessage?: IncomingNotificationMessage | null;
    uniqueSenders?: { patientId: number; patientName: string; doctorId: number }[];
}

export type PatientNotificationTarget =
    | { kind: 'announcement' }
    | { kind: 'chat'; patientId: number; doctorId: number; doctorName: string; profilePicUrl?: string | null };

export const parsePatientNotificationTarget = (
    data?: Record<string, unknown> | null
): PatientNotificationTarget | null => {
    if (!data) return null;

    if (data.type === 'announcement') {
        return { kind: 'announcement' };
    }

    if (data.type !== 'chat') {
        return null;
    }

    const patientId = Number(data.patientId);
    const doctorId = Number(data.doctorId);

    if (!Number.isFinite(patientId) || !Number.isFinite(doctorId)) {
        return null;
    }

    const doctorName =
        String(data.senderName || data.doctorName || data.doctor_name || 'Doctor').trim() || 'Doctor';
    const profilePicUrl = data.profilePicUrl ? String(data.profilePicUrl) : null;

    return {
        kind: 'chat',
        patientId,
        doctorId,
        doctorName,
        profilePicUrl,
    };
};

export const getPatientUnreadDoctorIdFromNotification = (
    data?: Record<string, unknown> | null
) => {
    const target = parsePatientNotificationTarget(data);
    return target?.kind === 'chat' ? target.doctorId : null;
};

export const getChatNotifications = async (since: string): Promise<ChatNotificationsResponse> => {
    const response = await client.get(`/chat/notifications?since=${encodeURIComponent(since)}`);
    return response.data;
};
