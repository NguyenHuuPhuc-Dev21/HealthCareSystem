import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { getVitalSignsWarnings } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface VitalEntry {
  id: string;
  time: string;
  hr: number;
  sys: number;
  dia: number;
  temp: number;
  spo2: number;
}

interface VitalsTabProps {
  vitalsList: VitalEntry[];
  onAddVitals: (entry: VitalEntry) => void;
}

export const VitalsTab: React.FC<VitalsTabProps> = ({ vitalsList, onAddVitals }) => {
  const [hr, setHr] = useState('76');
  const [sys, setSys] = useState('120');
  const [dia, setDia] = useState('80');
  const [temp, setTemp] = useState('36.8');
  const [spo2, setSpo2] = useState('98');

  const handleSave = () => {
    const nHr = Number(hr);
    const nSys = Number(sys);
    const nDia = Number(dia);
    const nTemp = Number(temp);
    const nSpo2 = Number(spo2);

    if (!nHr || !nSys || !nDia || !nTemp || !nSpo2) {
      Alert.alert('Thiếu chỉ số sinh tồn', 'Vui lòng nhập đầy đủ Mạch, Huyết áp, Thân nhiệt và SpO2.');
      return;
    }

    const warnings = getVitalSignsWarnings({
      heartRate: nHr,
      bloodPressureSystolic: nSys,
      bloodPressureDiastolic: nDia,
      temperature: nTemp,
      spo2: nSpo2,
    });
    const entry: VitalEntry = {
      id: String(Date.now()),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      hr: nHr,
      sys: nSys,
      dia: nDia,
      temp: nTemp,
      spo2: nSpo2,
    };

    onAddVitals(entry);

    if (warnings.length > 0) {
      Alert.alert(
        'Cảnh báo chỉ số vượt ngưỡng',
        `${warnings.join(' · ')}. Hãy theo dõi sát người bệnh hoặc bấm nút SOS 115 nếu diễn biến xấu.`
      );
    } else {
      Alert.alert('Đã lưu sinh tồn', 'Chỉ số sinh tồn đã được đồng bộ cho gia đình người bệnh.');
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Biểu mẫu nhập chỉ số */}
      <View style={styles.ledgerCard}>
        <Text style={styles.cardTitle}>Ghi nhận sinh tồn hiện tại</Text>
        <Text style={styles.cardSub}>
          Hệ thống tự động đánh dấu cảnh báo nếu mạch, huyết áp, nhiệt độ hoặc SpO2 vượt ngưỡng an toàn.
        </Text>

        <View style={styles.grid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Mạch (l/phút)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={hr} onChangeText={setHr} />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>SpO2 (%)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={spo2} onChangeText={setSpo2} />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>HA Tâm thu</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={sys} onChangeText={setSys} />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>HA Tâm trương</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={dia} onChangeText={setDia} />
          </View>
          <View style={[styles.inputBox, { width: '100%' }]}>
            <Text style={styles.inputLabel}>Thân nhiệt (°C)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={temp} onChangeText={setTemp} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Lưu chỉ số sinh tồn và đồng bộ"
        >
          <Text style={styles.saveBtnText}>Lưu chỉ số và đồng bộ</Text>
        </TouchableOpacity>
      </View>

      {/* Lịch sử đo */}
      <View style={styles.ledgerCard}>
        <Text style={styles.cardTitle}>Nhật ký theo dõi sinh tồn</Text>
        {vitalsList.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có lần đo nào trong ca này.</Text>
        ) : (
          vitalsList.map((v, idx) => {
            const warnings = getVitalSignsWarnings({
              heartRate: v.hr,
              bloodPressureSystolic: v.sys,
              bloodPressureDiastolic: v.dia,
              temperature: v.temp,
              spo2: v.spo2,
            });
            const hasWarning = warnings.length > 0;
            return (
              <View
                key={v.id}
                style={[styles.logRow, idx === vitalsList.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}
              >
                <View style={styles.logHeader}>
                  <Text style={styles.logTime}>{v.time}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: hasWarning ? tokens.colors.alertCrimsonSoft : tokens.colors.brandJadeSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: hasWarning ? tokens.colors.alertCrimson : tokens.colors.brandJade },
                      ]}
                    >
                      {hasWarning ? 'Cần chú ý' : 'Ổn định'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.logMetrics}>
                  Mạch {v.hr} l/p · HA {v.sys}/{v.dia} mmHg · Nhiệt độ {v.temp}°C · SpO2 {v.spo2}%
                </Text>

                {hasWarning && (
                  <Text style={styles.warningNote}>{warnings.join(' · ')}</Text>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputBox: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
    marginBottom: 4,
  },
  input: {
    minHeight: tokens.spacing.touchTargetMin,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    backgroundColor: tokens.colors.canvas,
  },
  saveBtn: {
    marginTop: 14,
    height: tokens.spacing.touchTargetMin,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14.5,
    color: tokens.colors.inkMuted,
    marginTop: 6,
  },
  logRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  logMetrics: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
  },
  warningNote: {
    marginTop: 4,
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
  },
});

