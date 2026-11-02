import { apiClient } from '../../lib/api-client';

export async function getSystemConfigs() {
  return apiClient<Record<string, unknown>>('/admin/configs');
}

export async function updateSystemConfig(configKey: string, configValue: unknown) {
  return apiClient<{ updated: boolean }>(`/admin/configs/${configKey}`, {
    method: 'PATCH',
    body: JSON.stringify({ config_value: configValue }),
  });
}

