import React from 'react';
import { CheckSquare, Clock } from 'lucide-react';
import { CareActivityItem } from '../shift.types';
import { toggleCareActivity } from '../shift.api';

interface CareActivitiesChecklistProps {
  bookingId: string;
  activities: CareActivityItem[];
  onActivityToggled: (activityId: string, completed: boolean) => void;
}

export const CareActivitiesChecklist: React.FC<CareActivitiesChecklistProps> = ({
  bookingId,
  activities,
  onActivityToggled,
}) => {
  const completedCount = activities.filter((a) => a.completed).length;
  const progressPercent = Math.round((completedCount / (activities.length || 1)) * 100);

  const handleToggle = async (activity: CareActivityItem) => {
    const nextCompleted = !activity.completed;
    onActivityToggled(activity.id, nextCompleted);
    await toggleCareActivity({
      bookingId,
      activityId: activity.id,
      completed: nextCompleted,
    });
  };

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckSquare size={20} color="var(--teal)" />
          Kế hoạch chăm sóc &amp; Đầu việc ({completedCount}/{activities.length})
        </h3>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>
          {progressPercent}% hoàn thành
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: 'var(--teal)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activities.map((item) => (
          <label
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              backgroundColor: item.completed ? '#F0FDF4' : '#F8FAFC',
              border: `1px solid ${item.completed ? '#86EFAC' : 'var(--line)'}`,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggle(item)}
              style={{ width: 18, height: 18, accentColor: 'var(--teal)', cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: item.completed ? '#166534' : 'var(--navy)',
                  textDecoration: item.completed ? 'line-through' : 'none',
                }}
              >
                {item.title}
                {item.mandatory && (
                  <span style={{ color: 'var(--red)', marginLeft: 4, fontWeight: 700 }}>*</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--slate)', display: 'flex', gap: 8, marginTop: 2 }}>
                <span className="chip" style={{ fontSize: 11, padding: '1px 6px' }}>
                  {item.category}
                </span>
                {item.completed && item.completedAt && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#166534' }}>
                    <Clock size={12} /> Đã làm lúc {item.completedAt}
                  </span>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};
