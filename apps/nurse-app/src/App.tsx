import React, { useState } from 'react';
import { SafeAreaView, Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { tokens } from './styles/tokens';
import { ShiftBriefingScreen } from './features/shift-briefing/ShiftBriefingScreen';
import { CheckInScreen } from './features/check-in/CheckInScreen';
import { ActiveShiftScreen } from './features/active-shift/ActiveShiftScreen';
import {
  CHECKIN_MAX_RADIUS_METERS,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
  DEFAULT_TRAVEL_SUPPORT_VND,
} from '@healthcare-system/shared';

type AppView = 'HOME' | 'BRIEFING' | 'CHECKIN' | 'ACTIVE_SHIFT' | 'COMPLETED' | 'CANCELLED_SAFE';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('HOME');
  const [outcomeNote, setOutcomeNote] = useState<string | undefined>();

  const sampleShift = {
    bookingId: 'job-1',
    bookingCode: 'BK-20261102-001',
    patientName: 'Bà Nguyễn Thị Mai',
    patientAge: 78,
    patientAddress: 'Số 25 Quang Trung, Hải Châu, Đà Nẵng',
    patientLatitude: 16.0718,
    patientLongitude: 108.2205,
    serviceName: 'Chăm sóc vết loét độ 3 và thay băng',
    timeRange: '08:00 – 12:00 hôm nay',
    mobilityNote: 'Nằm tại giường, cần hỗ trợ xoay trở nhẹ nhàng',
    allergies: 'Dị ứng kháng sinh nhóm Penicillin',
    isInvasive: true,
    prescriptionSummary:
      'Đơn thuốc ngày 26/10/2026: Dung dịch sát khuẩn vết loét Povidone Iodine 10%, gạc vô khuẩn và băng ép chuyên dụng.',
  };

  if (currentView === 'BRIEFING') {
    return (
      <SafeAreaView style={styles.container}>
        <ShiftBriefingScreen
          bookingCode={sampleShift.bookingCode}
          serviceName={sampleShift.serviceName}
          timeRange={sampleShift.timeRange}
          patientName={sampleShift.patientName}
          patientAge={sampleShift.patientAge}
          patientAddress={sampleShift.patientAddress}
          mobilityNote={sampleShift.mobilityNote}
          allergies={sampleShift.allergies}
          isInvasive={sampleShift.isInvasive}
          prescriptionSummary={sampleShift.prescriptionSummary}
          onProceedToCheckIn={() => setCurrentView('CHECKIN')}
          onBack={() => setCurrentView('HOME')}
        />
      </SafeAreaView>
    );
  }

  if (currentView === 'CHECKIN') {
    return (
      <SafeAreaView style={styles.container}>
        <CheckInScreen
          bookingId={sampleShift.bookingId}
          bookingCode={sampleShift.bookingCode}
          patientAddress={sampleShift.patientAddress}
          patientLatitude={sampleShift.patientLatitude}
          patientLongitude={sampleShift.patientLongitude}
          onCheckInSuccess={() => setCurrentView('ACTIVE_SHIFT')}
          onCancel={() => setCurrentView('BRIEFING')}
        />
      </SafeAreaView>
    );
  }

  if (currentView === 'ACTIVE_SHIFT') {
    return (
      <SafeAreaView style={styles.container}>
        <ActiveShiftScreen
          bookingId={sampleShift.bookingId}
          bookingCode={sampleShift.bookingCode}
          patientName={sampleShift.patientName}
          patientAge={sampleShift.patientAge}
          patientAddress={sampleShift.patientAddress}
          patientLatitude={sampleShift.patientLatitude}
          patientLongitude={sampleShift.patientLongitude}
          serviceName={sampleShift.serviceName}
          isInvasive={sampleShift.isInvasive}
          onShiftCompleted={(outcome) => {
            setOutcomeNote(outcome?.note);
            if (outcome?.type === 'CANCELLED_SAFE') {
              setCurrentView('CANCELLED_SAFE');
            } else {
              setCurrentView('COMPLETED');
            }
          }}
        />
      </SafeAreaView>
    );
  }

  if (currentView === 'CANCELLED_SAFE') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Ca trực đã dừng an toàn</Text>
            <Text style={styles.resultSubtitle}>
              Hệ thống đã ghi nhận lý do dừng ca ({outcomeNote || 'Bảo vệ an toàn lâm sàng'}). Bạn không bị phạt tiền, không trừ điểm tin cậy và được hỗ trợ {DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ chi phí di chuyển nếu do sai lệch y lệnh.
            </Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setCurrentView('HOME')}
              accessibilityRole="button"
              accessibilityLabel="Về màn hình chính"
            >
              <Text style={styles.actionBtnText}>Về màn hình chính</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (currentView === 'COMPLETED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Ca làm việc đã hoàn tất</Text>
            <Text style={styles.resultSubtitle}>
              Báo cáo ca tối thiểu đã được gửi cho người nhà. Thù lao sẽ tự động quyết toán sau {DEFAULT_SETTLEMENT_COOLING_HOURS} giờ và quyền xem hồ sơ bệnh án sẽ tự động khóa sau {DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ để bảo vệ dữ liệu riêng tư.
            </Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setCurrentView('HOME')}
              accessibilityRole="button"
              accessibilityLabel="Về màn hình chính"
            >
              <Text style={styles.actionBtnText}>Về màn hình chính</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.homeHead}>
          <Text style={styles.brandMark}>CareNest</Text>
          <Text style={styles.title}>Lịch trực hôm nay</Text>
          <Text style={styles.subtitle}>
            Kiểm tra hồ sơ người bệnh, điểm danh tại nhà và ghi nhận chăm sóc lâm sàng.
          </Text>
        </View>

        {/* Ca trực trọng tâm hôm nay */}
        <View style={styles.anchorCard}>
          <View style={styles.badgeRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Đã xác nhận</Text>
            </View>
            <Text style={styles.timeText}>{sampleShift.timeRange}</Text>
          </View>

          <Text style={styles.serviceName}>{sampleShift.serviceName}</Text>
          <Text style={styles.patientInfo}>
            Người bệnh: {sampleShift.patientName} ({sampleShift.patientAge} tuổi)
          </Text>
          <Text style={styles.addressInfo}>{sampleShift.patientAddress}</Text>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.briefingBtn}
              onPress={() => setCurrentView('BRIEFING')}
              accessibilityRole="button"
              accessibilityLabel="Xem hồ sơ ca trực"
            >
              <Text style={styles.briefingBtnText}>Xem hồ sơ ca</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkInBtn}
              onPress={() => setCurrentView('CHECKIN')}
              accessibilityRole="button"
              accessibilityLabel="Điểm danh vào ca"
            >
              <Text style={styles.checkInBtnText}>Điểm danh vào ca</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danh mục quy trình hỗ trợ tại hiện trường */}
        <View style={styles.ledgerCard}>
          <Text style={styles.ledgerTitle}>Quy trình thực hiện tại nhà người bệnh</Text>
          {[
            '1. Xem trước hồ sơ dị ứng, vận động và chỉ đường GPS',
            `2. Điểm danh trong phạm vi ${CHECKIN_MAX_RADIUS_METERS}m bằng ảnh selfie trực tiếp`,
            '3. Đánh giá thể trạng 30 phút đầu và đo sinh tồn định kỳ',
            '4. Đối chiếu y lệnh gốc hoặc gọi SOS 115 khi khẩn cấp',
            '5. Lưu báo cáo tối thiểu và bàn giao ra về',
          ].map((step, idx, arr) => (
            <View
              key={step}
              style={[styles.stepRow, idx === arr.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}
            >
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  homeHead: {
    marginBottom: 18,
  },
  brandMark: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.brandJade,
    marginBottom: 4,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
  },
  anchorCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusPill: {
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.brandJade,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  serviceName: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 26,
    marginBottom: 6,
  },
  patientInfo: {
    fontSize: 15.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  addressInfo: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  briefingBtn: {
    flex: 1,
    height: tokens.spacing.touchTargetMin,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.paper,
  },
  briefingBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  checkInBtn: {
    flex: 1.2,
    height: tokens.spacing.touchTargetMin,
    borderRadius: 10,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  ledgerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  stepRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  stepText: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
  },
  resultCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginTop: 28,
  },
  resultTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 10,
  },
  resultSubtitle: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 23,
    marginBottom: 22,
  },
  actionBtn: {
    backgroundColor: tokens.colors.brandJade,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
