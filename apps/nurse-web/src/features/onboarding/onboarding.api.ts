import { apiClient } from '../../lib/api-client';

export async function submitOnboarding(data: FormData) {
  return apiClient<{ profile_id: string; profile_status: string }>('/auth/nurse-onboarding', {
    method: 'POST',
    body: data,
  });
}

