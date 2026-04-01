import client from './client';

export const getPatientAnnouncements = async (limit: number = 30) => {
  const response = await client.get(`/announcements?mode=received&limit=${encodeURIComponent(limit)}`);
  return response.data as {
    announcements: Array<{
      message_id: number;
      doctor_id: number;
      doctor_name: string;
      content: string;
      created_at: string;
      appointment_date: string | null;
    }>;
  };
};
