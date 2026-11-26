import { authHandlers } from './auth.handlers';
import { installMockFetch } from './mock-fetch';
import { nurseVerificationHandlers } from './nurse-verification.handlers';
import { adminDisputeHandlers } from './disputes.handlers';
import { financeHandlers } from './finance.handlers';
import { catalogHandlers } from './catalog.handlers';
import { configsHandlers } from './configs.handlers';
import { usersHandlers } from './users.handlers';

/** Gộp handler của các feature. Feature mới thì thêm file *.handlers.ts và spread vào đây. */
export function installMockApi(): void {
  installMockFetch({
    ...authHandlers,
    ...nurseVerificationHandlers,
    ...usersHandlers,
    ...configsHandlers,
    ...catalogHandlers,
    ...financeHandlers,
    ...adminDisputeHandlers,
  });
  console.info('[mock] Mock API đang bật (VITE_USE_MOCK=true)');
}
