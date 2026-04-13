export type CareSpecializationId =
  | 'general-physician'
  | 'dermatologist'
  | 'dentist'
  | 'pediatrician'
  | 'orthopedic'
  | 'ent'
  | 'cardiologist'
  | 'surgeon'
  | 'senior-consultant';

export type CareSpecialization = {
  id: CareSpecializationId;
  label: string;
  description: string;
  aliases: string[];
  colors: {
    surface: string;
    border: string;
    iconBg: string;
    icon: string;
  };
};

export type DoctorSpecializationLike = {
  specialization?: string | null;
};

export const SPECIALIZATION_SOURCE_LIST: CareSpecialization[] = [
  {
    id: 'general-physician',
    label: 'General Physician',
    description: 'Primary care and everyday health needs',
    aliases: ['general physician', 'general doctor', 'general medicine', 'general', 'physician'],
    colors: { surface: '#eff6ff', border: '#bfdbfe', iconBg: '#dbeafe', icon: '#1d4ed8' },
  },
  {
    id: 'dermatologist',
    label: 'Dermatologist',
    description: 'Skin, hair, and allergy concerns',
    aliases: ['dermatologist', 'dermatology', 'skin specialist', 'skin'],
    colors: { surface: '#fff7ed', border: '#fed7aa', iconBg: '#ffedd5', icon: '#ea580c' },
  },
  {
    id: 'dentist',
    label: 'Dentist',
    description: 'Dental pain, cleaning, and oral care',
    aliases: ['dentist', 'dental', 'dental surgeon'],
    colors: { surface: '#ecfdf5', border: '#a7f3d0', iconBg: '#d1fae5', icon: '#059669' },
  },
  {
    id: 'pediatrician',
    label: 'Pediatrician',
    description: 'Children health, growth, and vaccines',
    aliases: ['pediatrician', 'pediatrics', 'paediatrician', 'paediatrics', 'child specialist', 'child'],
    colors: { surface: '#fdf2f8', border: '#fbcfe8', iconBg: '#fce7f3', icon: '#db2777' },
  },
  {
    id: 'orthopedic',
    label: 'Orthopedic',
    description: 'Bones, joints, posture, and mobility',
    aliases: ['orthopedic', 'orthopaedic', 'ortho', 'bone specialist', 'joint specialist', 'bone', 'joint'],
    colors: { surface: '#f5f3ff', border: '#ddd6fe', iconBg: '#ede9fe', icon: '#7c3aed' },
  },
  {
    id: 'ent',
    label: 'ENT Specialist',
    description: 'Ear, nose, throat, and sinus issues',
    aliases: ['ent', 'ear nose throat', 'ear', 'nose', 'throat', 'sinus'],
    colors: { surface: '#ecfeff', border: '#a5f3fc', iconBg: '#cffafe', icon: '#0891b2' },
  },
  {
    id: 'cardiologist',
    label: 'Cardiologist',
    description: 'Heart care, blood pressure, and circulation',
    aliases: ['cardiologist', 'cardiology', 'heart specialist', 'heart'],
    colors: { surface: '#fff1f2', border: '#fecdd3', iconBg: '#ffe4e6', icon: '#e11d48' },
  },
  {
    id: 'surgeon',
    label: 'Surgeon',
    description: 'Surgical consults and procedures',
    aliases: ['surgeon', 'surgery', 'surgical', 'general surgeon'],
    colors: { surface: '#f0fdfa', border: '#99f6e4', iconBg: '#ccfbf1', icon: '#0f766e' },
  },
  {
    id: 'senior-consultant',
    label: 'Senior Consultant',
    description: 'Experienced specialist consultations',
    aliases: ['senior consultant', 'consultant', 'senior doctor', 'specialist consultant'],
    colors: { surface: '#fefce8', border: '#fde68a', iconBg: '#fef3c7', icon: '#b45309' },
  },
];

export const normalizeSpecialization = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ');

export const getSpecializationById = (id?: string | null) =>
  SPECIALIZATION_SOURCE_LIST.find((item) => item.id === id) || null;

export const resolveSpecializationId = (value?: string | null): CareSpecializationId | null => {
  const normalized = normalizeSpecialization(value);
  if (!normalized) return null;

  for (const item of SPECIALIZATION_SOURCE_LIST) {
    if (item.aliases.some((alias) => normalized.includes(normalizeSpecialization(alias)))) {
      return item.id;
    }
  }

  return null;
};

export const matchesSpecialization = (
  doctorSpecialization: string | null | undefined,
  specializationId?: CareSpecializationId | null
) => {
  if (!specializationId) return true;
  return resolveSpecializationId(doctorSpecialization) === specializationId;
};

export const matchesSpecializationQuery = (
  doctorSpecialization: string | null | undefined,
  specializationQuery?: string | null
) => {
  const doctorNormalized = normalizeSpecialization(doctorSpecialization);
  const queryNormalized = normalizeSpecialization(specializationQuery);

  if (!queryNormalized) return true;
  return doctorNormalized.includes(queryNormalized) || queryNormalized.includes(doctorNormalized);
};

export const countDoctorsForSpecialization = (
  doctors: DoctorSpecializationLike[],
  specializationId: CareSpecializationId
) => doctors.filter((doctor) => matchesSpecialization(doctor.specialization, specializationId)).length;

export const getAvailableBackendSpecializations = (doctors: DoctorSpecializationLike[]) => {
  const seen = new Map<string, { raw: string; specializationId: CareSpecializationId | null }>();

  doctors.forEach((doctor) => {
    const raw = String(doctor.specialization || '').trim();
    if (!raw) return;
    const key = normalizeSpecialization(raw);
    if (!key || seen.has(key)) return;
    seen.set(key, {
      raw,
      specializationId: resolveSpecializationId(raw),
    });
  });

  return Array.from(seen.values()).sort((a, b) => a.raw.localeCompare(b.raw));
};
