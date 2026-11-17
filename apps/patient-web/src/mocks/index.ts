import { authHandlers } from './auth.handlers';
import { ekycHandlers } from './ekyc.handlers';
import { installMockFetch } from './mock-fetch';
import { bookingHandlers } from './booking.handlers';
import { nurseSearchHandlers } from './nurse-search.handlers';
import { patientProfileHandlers } from './patient-profiles.handlers';
import { trackingHandlers } from './tracking.handlers';

/** Gộp handler của các feature. Feature mới thì thêm file *.handlers.ts và spread vào đây. */
export function installMockApi(): void {
  installMockFetch({
    ...authHandlers,
    ...ekycHandlers,
    ...patientProfileHandlers,
    ...nurseSearchHandlers,
    ...bookingHandlers,
    ...trackingHandlers,
  });
  console.info('[mock] Mock API đang bật (VITE_USE_MOCK=true)');
}
