import { authHandlers } from './auth.handlers';
import { ekycHandlers } from './ekyc.handlers';
import { installMockFetch } from './mock-fetch';
import { patientProfileHandlers } from './patient-profiles.handlers';

/** Gộp handler của các feature. Feature mới thì thêm file *.handlers.ts và spread vào đây. */
export function installMockApi(): void {
  installMockFetch({
    ...authHandlers,
    ...ekycHandlers,
    ...patientProfileHandlers,
  });
  console.info('[mock] Mock API đang bật (VITE_USE_MOCK=true)');
}
