import { authHandlers } from './auth.handlers';
import { installMockFetch } from './mock-fetch';
import { nurseVerificationHandlers } from './nurse-verification.handlers';

/** Gộp handler của các feature. Feature mới thì thêm file *.handlers.ts và spread vào đây. */
export function installMockApi(): void {
  installMockFetch({
    ...authHandlers,
    ...nurseVerificationHandlers,
  });
  console.info('[mock] Mock API đang bật (VITE_USE_MOCK=true)');
}
