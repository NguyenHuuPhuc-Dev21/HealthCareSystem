import type { NurseTier, ServiceType, ServiceUnit } from '@healthcare-system/shared';

/** A service_categories row as stored (snake_case columns). */
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

/** Columns an Admin may set. `code` only at creation. */
export type EditableFields = Pick<
  ServiceCategoryRow,
  'name' | 'service_type' | 'is_invasive' | 'is_prohibited' | 'required_tier' | 'base_price' | 'unit' | 'is_active'
>;

/** Same shape as admin-web features/catalog/catalog.types.ts ServiceCategory (camelCase). */
export interface ServiceCategoryDto {
  id: string;
  code: string;
  name: string;
  serviceType: ServiceType;
  isInvasive: boolean;
  isProhibited: boolean;
  requiredTier: NurseTier;
  basePrice: number;
  unit: ServiceUnit;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
