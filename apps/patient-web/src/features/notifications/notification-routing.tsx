import { AlertTriangle, Bell, CalendarX, Gavel, MessageSquare, Siren, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NotificationDto } from './notifications.api';

/** Đích điều hướng khi bấm vào thông báo (chỉ dùng mã định tuyến trong `data`, không có dữ liệu y tế). */
export function routeForNotification(n: NotificationDto): string | null {
  const d = n.data ?? {};
  const bookingId = (d.bookingId ?? d.conversationId) as string | undefined;
  if (n.type.startsWith('DISPUTE')) return d.disputeId ? `/disputes?open=${encodeURIComponent(String(d.disputeId))}` : '/disputes';
  if (n.type === 'NEW_MESSAGE') return bookingId ? `/bookings/${bookingId}?chat=1` : '/bookings';
  if (n.type.startsWith('SOS')) return bookingId ? `/bookings/${bookingId}` : '/bookings';
  if (n.type.includes('REFUND')) return '/refunds';
  if (n.type === 'BOOKING_EXPIRED' || n.type === 'BOOKING_CANCELLED') return '/bookings';
  return bookingId ? `/bookings/${bookingId}` : null;
}

export function iconForNotification(n: NotificationDto): ReactNode {
  if (n.type.startsWith('SOS')) return <Siren size={18} />;
  if (n.type.startsWith('DISPUTE')) return <Gavel size={18} />;
  if (n.type === 'NEW_MESSAGE') return <MessageSquare size={18} />;
  if (n.type.includes('REFUND') || n.type.includes('SETTLEMENT') || n.type.includes('PAYMENT')) return <Wallet size={18} />;
  if (n.type.startsWith('BOOKING')) return <CalendarX size={18} />;
  if (n.priority === 'HIGH') return <AlertTriangle size={18} />;
  return <Bell size={18} />;
}

/** "5 phút trước", "3 giờ trước", "2 ngày trước"; quá 7 ngày thì hiện ngày. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return 'Vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  if (d <= 7) return `${d} ngày trước`;
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}
