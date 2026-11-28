export type ConfigDataType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'JSON';

export type ConfigRow = {
  config_key: string;
  config_value: string;
  data_type: ConfigDataType;
  description: string | null;
  updated_by: string | null;
  updated_at: Date;
};

export interface ConfigItemDto {
  value: unknown;
  dataType: ConfigDataType;
  description: string | null;
  updatedAt: string;
  /** Admin who last changed it; null = seeded by a migration. */
  updatedBy: string | null;
}

export interface UpdateConfigResult {
  /** false when the new value equals the stored one (nothing written, no audit). */
  updated: boolean;
  key: string;
  value: unknown;
}
