/**
 * notifications jobs on the shared queue (BE-3 · Phase 6 · TC-NFR-01).
 *   notifications.urgent-sms-fallback   { notificationId } at dispatch + 60 s (key notif-fallback:<id>)
 * Scheduled by core/notifications for every HIGH priority notice; sends one SMS if still unacknowledged.
 */
import { getNotificationDispatcher } from './notifications.service';

export function registerNotificationsJobs(): void {
  getNotificationDispatcher(); // creating the dispatcher registers the fallback handler on core/jobs
}
