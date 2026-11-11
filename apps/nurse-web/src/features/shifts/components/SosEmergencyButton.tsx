import React, { useState } from 'react';
import { PhoneCall, AlertOctagon, RefreshCw } from 'lucide-react';
import { triggerSosAlert } from '../shift.api';
import { VitalSignRecord } from '../shift.types';

interface SosEmergencyButtonProps {
  bookingId: string;
  latitude: number;
  longitude: number;
  latestVitals?: VitalSignRecord;
}

type SosDispatchStatus = 'idle' | 'sending' | 'sent' | 'failed';

export const SosEmergencyButton: React.FC<SosEmergencyButtonProps> = ({
  bookingId,
  latitude,
  longitude,
  latestVitals,
}) => {
  const [sosStatus, setSosStatus] = useState<SosDispatchStatus>('idle');
  const [emergencyId, setEmergencyId] = useState<string | null>(null);
  const [sosError, setSosError] = useState<string | null>(null);

  const dispatchSystemAlert = async () => {
    setSosStatus('sending');
    setSosError(null);
    try {
      const res = await triggerSosAlert({
        bookingId,
        latitude,
        longitude,
        currentVitals: latestVitals,
        incidentDetails: 'Kích hoạt SOS khẩn cấp trong ca trực',
      });
      if (res.success) {
        setEmergencyId(res.emergencyId || null);
        setSosStatus('sent');
      } else {
        setSosStatus('failed');
        setSosError(res.message || 'Không thể gửi cảnh báo hệ thống tới Admin & người nhà.');
      }
    } catch {
      setSosStatus('failed');
      setSosError('Mất kết nối mạng khi gửi GPS & sinh tồn tới Admin. Vui lòng thử gửi lại.');
    }
  };

  const activateSos = async () => {
    // 1. Step 1 (On-Site): Call 115 immediately with ZERO network latency (BR-23 §2.2)
    window.location.href = 'tel:115';

    // 2. Step 2 (System Alert): Concurrently dispatches GPS coordinates & vitals and reports actual status
    await dispatchSystemAlert();
  };

  if (sosStatus === 'idle') {
    return (
      <div>
        <button
          type="button"
          onClick={activateSos}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 12,
            backgroundColor: '#DC2626',
            color: '#ffffff',
            border: 'none',
            fontSize: 16,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.3)',
          }}
        >
          <AlertOctagon size={22} />
          BÁO ĐỘNG SOS KHẨN CẤP (GỌI 115 NGAY LẬP TỨC)
        </button>
      </div>
    );
  }

  return (
    <div
      role={sosStatus === 'failed' ? 'alert' : 'status'}
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        background: sosStatus === 'failed' ? '#FEF2F2' : '#FEE2E2',
        border: `2px solid ${sosStatus === 'failed' ? '#B91C1C' : '#EF4444'}`,
        color: '#991B1B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <AlertOctagon size={24} color="#EF4444" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {sosStatus === 'sending'
              ? 'ĐANG GỌI 115 & GỬI TÍN HIỆU KHẨN CẤP...'
              : sosStatus === 'sent'
              ? 'ĐÃ PHÁT TÍN HIỆU CẤP CỨU KHẨN CẤP (115)!'
              : 'CHƯA GỬI ĐƯỢC CẢNH BÁO GPS TỚI HỆ THỐNG'}
          </div>
          <div style={{ fontSize: 13.5, marginTop: 2 }}>
            {sosStatus === 'sending'
              ? 'Đang đồng bộ tọa độ GPS & chỉ số sinh tồn tới Admin và người nhà...'
              : sosStatus === 'sent'
              ? `Đã gửi GPS + chỉ số sinh tồn tới Admin & người nhà${emergencyId ? ` (${emergencyId})` : ''}.`
              : sosError}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sosStatus === 'failed' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ minHeight: 44 }}
            onClick={dispatchSystemAlert}
          >
            <RefreshCw size={15} aria-hidden="true" /> Thử gửi lại cảnh báo GPS
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm"
          style={{ background: '#DC2626', color: '#fff', border: 'none', minHeight: 44 }}
          onClick={() => (window.location.href = 'tel:115')}
        >
          <PhoneCall size={16} style={{ marginRight: 4 }} /> Gọi lại 115
        </button>
      </div>
    </div>
  );
};
