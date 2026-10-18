import { AccountType, OrderStatus } from '@healthcare-system/shared';

export function getApplicationBanner(): string {
  return `Hospital Home-Care Platform Backend API initialized. Supported Account Types: ${Object.keys(AccountType).length}, Order Statuses: ${Object.keys(OrderStatus).length}`;
}

console.log(getApplicationBanner());
