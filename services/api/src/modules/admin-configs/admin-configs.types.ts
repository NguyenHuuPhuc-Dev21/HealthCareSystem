export type ConfigDataType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'JSON';

export type ConfigRow = {
  config_key: string;
  config_value: string;
  data_type: ConfigDataType;
  description: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: Date;
};

/** Same shape as admin-web features/configs/configs.types.ts ConfigItem. */
export interface ConfigItemDto {
  key: string;
  /** As stored (VARCHAR 500), e.g. "0.15", "true", "19:00". */
  value: string;
  dataType: ConfigDataType;
  description: string | null;
  /** null = value seeded by a migration (no Admin changed it yet). */
  updatedBy: { id: string; name: string } | null;
  updatedAt: string;
}
