import React, { useState } from 'react';
import { SafeAreaView, Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { tokens } from './styles/tokens';
import { CheckInScreen } from './features/check-in/CheckInScreen';
import { ActiveShiftScreen } from './features/active-shift/ActiveShiftScreen';
import {
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
} from '@healthcare-system/shared';

export default function App() {
  const [currentView, setCurrentView] = useState<'HOME' | 'CHECKIN' | 'ACTIVE_SHIFT' | 'COMPLETED'>('HOME');

  const sampleShift = {
    bookingId: 'job-1',
    bookingCode: 'BK-20261102-001',
    patientName: 'Bà Nguyễn Thị Mai',
    patientAge: 78,
    patientAddress: 'Số 25 Quang Trung, Hải Châu, Đà Nẵng',
    patientLatitude: 16.0718,
    patientLongitude: 108.2205,
    serviceName: 'Chăm sóc vết loét độ 3 & Thay băng',
    isInvasive: true,
  };

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
          onCancel={() => setCurrentView('HOME')}
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
          onShiftCompleted={() => setCurrentView('COMPLETED')}
        />
      </SafeAreaView>
    );
  }

  if (currentView === 'COMPLETED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.completedCard}>
            <Text style={styles.completedTitle}>Ca Làm Việc Đã Hoàn Tất!</Text>
            <Text style={styles.completedSubtitle}>
              Báo cáo ca tối thiểu đã lưu. Đã kích hoạt đếm ngược {DEFAULT_SETTLEMENT_COOLING_HOURS}h tự động giải ngân và {DEFAULT_RECORD_ACCESS_EXPIRY_HOURS}h khóa xem bệnh án theo Nghị định 13.
            </Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setCurrentView('HOME')}
            >
              <Text style={styles.actionBtnText}>Về Màn Hình Chính</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>HealthCareSystem — Nurse Mobile App</Text>
        <Text style={styles.subtitle}>Ca làm việc hôm nay (Giai đoạn 4 — SHIFT Lead)</Text>

        {/* Confirmed Shift Card */}
        <View style={styles.shiftCard}>
          <View style={styles.badgeRow}>
            <View style={styles.chipConfirmed}>
              <Text style={styles.chipConfirmedText}>ĐÃ XÁC NHẬN</Text>
            </View>
            <Text style={styles.timeText}>08:00 – 12:00 Hôm nay</Text>
          </View>

          <Text style={styles.serviceName}>{sampleShift.serviceName}</Text>
          <Text style={styles.patientInfo}>
            Bệnh nhân: {sampleShift.patientName} ({sampleShift.patientAge} tuổi)
          </Text>
          <Text style={styles.addressInfo}>Địa chỉ: {sampleShift.patientAddress}</Text>

          <TouchableOpacity
            style={styles.checkInBtn}
            onPress={() => setCurrentView('CHECKIN')}
          >
            <Text style={styles.checkInBtnText}>Check-in Điểm Danh Khi Tới Nơi →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.paddingBase,
  },
  title: {
    fontSize: tokens.typography.fontSizeTitle,
    fontWeight: 'bold',
    color: tokens.colors.textMain,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: tokens.colors.textMuted,
    marginBottom: 16,
  },
  shiftCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chipConfirmed: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipConfirmedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  timeText: {
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.textMain,
    marginBottom: 4,
  },
  patientInfo: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.textMain,
    marginBottom: 2,
  },
  addressInfo: {
    fontSize: 13.5,
    color: tokens.colors.textMuted,
    marginBottom: 16,
  },
  checkInBtn: {
    backgroundColor: tokens.colors.primary,
    height: tokens.spacing.touchTargetMin,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  completedCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#86efac',
    alignItems: 'center',
    marginTop: 40,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 8,
  },
  completedSubtitle: {
    fontSize: 14.5,
    color: '#15803d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
