import type { NurseTier, ServiceType, ServiceUnit } from '@healthcare-system/shared';

/** A service_categories row, as stored and as returned (snake_case, like the table and admin-web). */
export type ServiceCategoryRow = {
  id: string;
  code: string;
  name: string;
  service_type: ServiceType;
  is_invasive: boolean;
  is_prohibited: boolean;
  required_tier: NurseTier;
  base_price: number;
  unit: ServiceUnit;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

/** Fields an Admin may set. `code` only at creation. */
export type EditableFields = Pick<
  ServiceCategoryRow,
  'name' | 'service_type' | 'is_invasive' | 'is_prohibited' | 'required_tier' | 'base_price' | 'unit' | 'is_active'
>;
