import { apiClient } from '../../lib/api-client';

export async function uploadRenewedGphn(data: FormData) {
  return apiClient<{ credential_id: string; verification_status: string }>('/nurse/credentials/gphn', {
    method: 'PUT',
    body: data,
  });
}

