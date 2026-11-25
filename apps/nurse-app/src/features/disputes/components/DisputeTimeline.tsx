import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock, Scale, ShieldAlert } from 'lucide-react-native';
import { DisputeStatus, type DisputeDto } from '@healthcare-system/shared';
import { formatDateTime } from '../../../lib/formatters';
import { tokens } from '../../../styles/tokens';

export interface DisputeTimelineProps {
  dispute: DisputeDto;
}

interface TimelineStep {
  key: string;
  title: string;
  subtitle: string;
  time?: string;
  done: boolean;
  tone: 'jade' | 'ochre' | 'crimson' | 'neutral';
}

export const DisputeTimeline: React.FC<DisputeTimelineProps> = ({ dispute }) => {
  const isPenaltyAppeal = dispute.kind === 'PENALTY_APPEAL';
  const isResolved =
    dispute.status === DisputeStatus.RESOLVED_CUSTOMER ||
    dispute.status === DisputeStatus.RESOLVED_NURSE ||
    dispute.status === DisputeStatus.RESOLVED_PARTIAL;

  const steps: TimelineStep[] = [
    {
      key: 'opened',
      title: isPenaltyAppeal
        ? 'Điều dưỡng gửi khiếu nại khoản trừ ký quỹ'
        : dispute.openedBy === 'PATIENT'
          ? 'Khách hàng mở khiếu nại'
          : 'Điều dưỡng mở khiếu nại',
      subtitle: `Mã ca ${dispute.bookingCode}`,
      time: dispute.createdAt,
      done: true,
      tone: 'ochre',
    },
  ];

  if (dispute.openedBy === 'PATIENT' && !isPenaltyAppeal) {
    steps.push({
      key: 'rebuttal',
      title: dispute.nurseRebuttal
        ? 'Điều dưỡng đã gửi phản hồi'
        : 'Chờ điều dưỡng phản hồi',
      subtitle: dispute.nurseRebuttal
        ? 'Đã tiếp nhận giải trình & bằng chứng'
        : dispute.rebuttalDueAt
          ? `Hạn chót: ${formatDateTime(dispute.rebuttalDueAt)}`
          : 'Vui lòng gửi giải trình sớm',
      time: dispute.nurseRebuttal?.submittedAt,
      done: Boolean(dispute.nurseRebuttal),
      tone: dispute.nurseRebuttal ? 'jade' : 'ochre',
    });
  }

  steps.push({
    key: 'review',
    title: 'Admin thẩm tra hồ sơ',
    subtitle: isResolved
      ? 'Đã hoàn tất đối chiếu chứng cứ'
      : dispute.status === DisputeStatus.UNDER_REVIEW
        ? 'Đang xem xét bằng chứng hai bên'
        : 'Chờ đủ thông tin để thẩm tra',
    done:
      dispute.status === DisputeStatus.UNDER_REVIEW || isResolved,
    tone:
      dispute.status === DisputeStatus.UNDER_REVIEW || isResolved
        ? 'jade'
        : 'neutral',
  });

  steps.push({
    key: 'resolved',
    title: 'Kết quả phân xử',
    subtitle: isResolved
      ? dispute.status === DisputeStatus.RESOLVED_NURSE
        ? isPenaltyAppeal
          ? 'Chấp nhận khiếu nại — Đã hoàn lại ký quỹ'
          : 'Điều dưỡng thắng — Giải phóng thù lao'
        : 'Khách thắng / Bác khiếu nại'
      : 'Chưa có phán quyết cuối cùng',
    time: dispute.resolution?.resolvedAt,
    done: isResolved,
    tone:
      dispute.status === DisputeStatus.RESOLVED_NURSE
        ? 'jade'
        : dispute.status === DisputeStatus.RESOLVED_CUSTOMER
          ? 'crimson'
          : 'neutral',
  });

  const renderIcon = (step: TimelineStep) => {
    const color =
      step.tone === 'jade'
        ? tokens.colors.brandJade
        : step.tone === 'ochre'
          ? tokens.colors.accentOchre
          : step.tone === 'crimson'
            ? tokens.colors.alertCrimson
            : tokens.colors.inkMuted;

    if (step.key === 'resolved' && step.tone === 'crimson') {
      return <ShieldAlert size={18} color={color} />;
    }
    if (step.key === 'review') {
      return <Scale size={18} color={color} />;
    }
    if (step.done) {
      return <CheckCircle2 size={18} color={color} />;
    }
    return <Clock size={18} color={color} />;
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Tiến trình xử lý</Text>
      {steps.map((step, index) => (
        <View key={step.key} style={styles.stepRow}>
          <View style={styles.railCol}>
            <View style={styles.dotWrap}>{renderIcon(step)}</View>
            {index < steps.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepSub}>{step.subtitle}</Text>
            {step.time ? (
              <Text style={styles.stepTime}>{formatDateTime(step.time)}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 16,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
  },
  railCol: {
    alignItems: 'center',
    width: 24,
  },
  dotWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: tokens.colors.borderHairline,
    marginVertical: 2,
  },
  stepBody: {
    flex: 1,
    paddingBottom: 14,
  },
  stepTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  stepSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
    lineHeight: 19,
  },
  stepTime: {
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
    marginTop: 2,
  },
});
