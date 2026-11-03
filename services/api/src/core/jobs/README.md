# core/jobs — Shared Job Queue (Owner: BE-2)

Mọi hẹn giờ nghiệp vụ (15' thanh toán, 24h quyết toán, 12h đóng bệnh án, quét GPHN...)
PHẢI đi qua module này. **Cấm `setTimeout` tự phát.** Engine: BullMQ 6 trên Redis.

## Hợp đồng nội bộ
```ts
import { scheduleJob, cancelJob, jobs } from '../../core/jobs';

await scheduleJob('settlements.release', { bookingId }, runAt, `settlement:${bookingId}`);
await cancelJob(`settlement:${bookingId}`);            // vd: khi có khiếu nại OPEN
jobs.registerHandler('settlements.release', async (payload, ctx) => { ... });
await jobs.scheduleRecurring('tier-lifecycle.sweep', { pattern: '0 2 * * *' }, 'tier-lifecycle.sweep');
```

## Quy ước
- `jobName`: `<module>.<việc>` — vd `booking-expiry.payment-timeout`
- `idempotencyKey`: `<việc>:<entityId>` — hẹn lại cùng key = no-op
- Handler **phải tự idempotent**: kiểm tra trạng thái DB trước khi đổi trạng thái/ghi tiền
  (job có thể chạy lại khi worker crash hoặc key hết hạn sau 7 ngày)
- `runAt` tính từ `getConfig()` — không hardcode số §5.1
- Lỗi hết retry → `healthcare-jobs-dlq`; `checkBacklog()` chạy mỗi 60s

## Chạy
- Worker: `npm run dev:worker`
- Test: `npm run test:integration --workspace=services/api` (cần Redis, dùng DB 15)