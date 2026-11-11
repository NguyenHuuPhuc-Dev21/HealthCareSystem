import React, { useState } from 'react';
import { PhoneCall, AlertOctagon } from 'lucide-react';
import { triggerSosAlert } from '../shift.api';
import { VitalSignRecord } from '../shift.types';

interface SosEmergencyButtonProps {
  bookingId: string;
  latitude: number;
  longitude: number;
  latestVitals?: VitalSignRecord;
}

export const SosEmergencyButton: React.FC<SosEmergencyButtonProps> = ({
  bookingId,
  latitude,
  longitude,
  latestVitals,
}) => {
  const [sosActivated, setSosActivated] = useState(false);
  const [emergencyId, setEmergencyId] = useState<string | null>(null);

  const activateSos = async () => {
    // 1. Step 1 (On-Site): Call 115 immediately with ZERO network latency (BR-23 §2.2)
    window.location.href = 'tel:115';

    // 2. Step 2 (System Alert): Concurrently dispatches GPS coordinates & vitals to Admin & Family (< 2s)
    setSosActivated(true);
    try {
      const res = await triggerSosAlert({
        bookingId,
        latitude,
        longitude,
        currentVitals: latestVitals,
        incidentDetails: 'Kích hoạt SOS khẩn cấp trong ca trực',
      });
      if (res.emergencyId) {
        setEmergencyId(res.emergencyId);
      }
    } catch (e) {
      console.error('SOS background alert error:', e);
    }
  };

  return (
    <div>
      {sosActivated ? (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: '#FEE2E2',
            border: '2px solid #EF4444',
            color: '#991B1B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertOctagon size={24} color="#EF4444" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                ĐÃ PHÁT TÍN HIỆU CẤP CỨU KHẨN CẤP (115)!
              </div>
              <div style={{ fontSize: 13 }}>
                Đã gửi GPS + chỉ số sinh tồn tới Admin &amp; người nhà {emergencyId ? `(${emergencyId})` : ''}.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: '#DC2626', color: '#fff', border: 'none', height: 38 }}
            onClick={() => (window.location.href = 'tel:115')}
          >
            <PhoneCall size={16} style={{ marginRight: 4 }} /> Gọi lại 115
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
};
