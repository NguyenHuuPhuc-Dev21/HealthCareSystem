import { apiClient } from '../../lib/api-client';

export interface PatientProfileDto {
  id: string;
  full_name: string;
  data_consent_accepted: boolean;
  location_type: 'HOSPITAL' | 'HOME';
}

export async function getPatientProfiles() {
  return apiClient<PatientProfileDto[]>('/patients/profiles');
}

