import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, ArrowRight, Check, LogOut, X } from 'lucide-react-native';
import { DocType } from '@healthcare-system/shared';
import { AppButton } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { createCameraProvider, type LiveCameraCaptureOptions } from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { OnboardingStackParamList } from '../../navigation/types';
import {
  clearOnboardingDraft,
  DEFAULT_ONBOARDING_DRAFT,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraftData,
} from './onboarding-draft';
import { DegreeStep } from './steps/DegreeStep';
import { GphnStep } from './steps/GphnStep';
import { IdCardStep } from './steps/IdCardStep';
import { PortraitStep } from './steps/PortraitStep';
import { ReviewStep } from './steps/ReviewStep';
import { SupplementStep } from './steps/SupplementStep';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingWizard'>;

const STEPS = [
  'CCCD',
  'Chân dung',
  'Bằng cấp',
  'GPHN',
  'Bổ trợ',
  'Xem lại',
];

export const OnboardingWizardScreen: React.FC<Props> = ({ route, navigation }) => {
  const { logout, updateProfile } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraftData>(DEFAULT_ONBOARDING_DRAFT);
  const [isReady, setIsReady] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Khôi phục nháp từ EncryptedStorage hoặc định hướng bước theo fixDocType
  useEffect(() => {
    let alive = true;
    void loadOnboardingDraft().then((saved) => {
      if (!alive) return;
      const initial = saved || DEFAULT_ONBOARDING_DRAFT;

      // Nếu có fixDocType từ màn PendingApproval -> nhảy thẳng đến bước tương ứng
      if (route.params?.fixDocType) {
        let targetStep = 0;
        switch (route.params.fixDocType) {
          case DocType.CCCD:
            targetStep = 0;
            break;
          case DocType.DEGREE:
            targetStep = 2;
            break;
          case DocType.GPHN:
            targetStep = 3;
            break;
          case DocType.RETIREMENT_DECISION:
            targetStep = 4;
            break;
          default:
            targetStep = 0;
        }
        setDraft({ ...initial, step: targetStep });
      } else {
        setDraft(initial);
      }
      setIsReady(true);
    });

    return () => {
      alive = false;
    };
  }, [route.params?.fixDocType]);

  const updateDraft = (patch: Partial<OnboardingDraftData>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      void saveOnboardingDraft(next);
      return next;
    });
  };

  const handleCapture = async (
    targetField: keyof OnboardingDraftData,
    options: LiveCameraCaptureOptions
  ) => {
    try {
      const provider = createCameraProvider(undefined, options);
      const uri = await provider();
      if (uri) {
        updateDraft({ [targetField]: uri });
      }
    } catch (err: any) {
      Alert.alert('Lỗi camera', err?.message || 'Không thể chụp ảnh.');
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Điều kiện để được chuyển sang bước kế tiếp
  const canProceed = (): boolean => {
    switch (draft.step) {
      case 0:
        return (
          draft.cccdNumber.trim().length === 12 &&
          Boolean(draft.cccdFrontUri) &&
          Boolean(draft.cccdBackUri)
        );
      case 1:
        return Boolean(draft.portraitUri);
      case 2:
        return Boolean(draft.degreeUri);
      case 3: {
        if (!draft.hasGphn) return true;
        const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
        const expiryValid =
          isoDateRe.test(draft.gphnExpiryDate) &&
          !Number.isNaN(Date.parse(draft.gphnExpiryDate)) &&
          draft.gphnExpiryDate > todayStr;
        const issuedValid =
          !draft.gphnIssuedDate ||
          (isoDateRe.test(draft.gphnIssuedDate) &&
            !Number.isNaN(Date.parse(draft.gphnIssuedDate)) &&
            draft.gphnExpiryDate > draft.gphnIssuedDate);
        return (
          Boolean(draft.gphnUri) &&
          Boolean(draft.gphnNumber.trim()) &&
          expiryValid &&
          issuedValid &&
          Boolean(draft.gphnAuthority.trim()) &&
          Boolean(draft.scopeOfPractice.trim())
        );
      }
      case 4:
        if (!draft.isRetired) return true;
        return Boolean(draft.retirementUri);
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (draft.step < STEPS.length - 1 && canProceed()) {
      const nextStep = draft.step + 1;
      updateDraft({ step: nextStep });
    }
  };

  const handleBack = () => {
    if (draft.step > 0) {
      const prevStep = draft.step - 1;
      updateDraft({ step: prevStep });
    }
  };

  const handleCancelRegistration = async () => {
    await clearOnboardingDraft();
    setShowCancelModal(false);
    await logout();
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Đang tải bản nháp hồ sơ...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <View style={styles.titleColumn}>
          <Text style={styles.topBarTitle}>Hồ sơ eKYC điều dưỡng</Text>
          <Text style={styles.topBarSubtitle}>
            Bước {draft.step + 1}/{STEPS.length} · {STEPS[draft.step]}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowCancelModal(true)}
          style={styles.cancelDraftBtn}
          accessibilityRole="button"
          accessibilityLabel="Hủy tạo hồ sơ"
        >
          <X color={tokens.colors.inkSecondary} size={20} />
          <Text style={styles.cancelDraftText}>Hủy</Text>
        </TouchableOpacity>
      </View>

      {/* Stepper progress dots / numbers */}
      <View style={styles.stepperContainer}>
        {STEPS.map((s, idx) => {
          const isDone = idx < draft.step;
          const isCurrent = idx === draft.step;
          return (
            <React.Fragment key={s}>
              <TouchableOpacity
                onPress={() => {
                  if (idx <= draft.step) {
                    updateDraft({ step: idx });
                  }
                }}
                disabled={idx > draft.step}
                style={[
                  styles.stepBadge,
                  isCurrent && styles.stepBadgeCurrent,
                  isDone && styles.stepBadgeDone,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Bước ${idx + 1}: ${s}`}
              >
                {isDone ? (
                  <Check color="#FFFFFF" size={14} />
                ) : (
                  <Text
                    style={[
                      styles.stepBadgeText,
                      isCurrent && styles.stepBadgeTextCurrent,
                    ]}
                  >
                    {idx + 1}
                  </Text>
                )}
              </TouchableOpacity>
              {idx < STEPS.length - 1 ? (
                <View
                  style={[
                    styles.stepConnector,
                    idx < draft.step && styles.stepConnectorDone,
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      {/* Body content per step */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {draft.step === 0 && (
          <IdCardStep
            cccdNumber={draft.cccdNumber}
            onCccdNumberChange={(cccdNumber) => updateDraft({ cccdNumber })}
            frontUri={draft.cccdFrontUri}
            onCaptureFront={() =>
              void handleCapture('cccdFrontUri', {
                mode: 'document',
                facing: 'back',
                instruction: 'Chụp rõ nét mặt trước Căn cước công dân.',
              })
            }
            onRemoveFront={() => updateDraft({ cccdFrontUri: null })}
            backUri={draft.cccdBackUri}
            onCaptureBack={() =>
              void handleCapture('cccdBackUri', {
                mode: 'document',
                facing: 'back',
                instruction: 'Chụp rõ nét mặt sau Căn cước công dân.',
              })
            }
            onRemoveBack={() => updateDraft({ cccdBackUri: null })}
          />
        )}

        {draft.step === 1 && (
          <PortraitStep
            portraitUri={draft.portraitUri}
            onCapturePortrait={() =>
              void handleCapture('portraitUri', {
                mode: 'selfie',
                facing: 'front',
                instruction: 'Chụp ảnh selfie trực tiếp khuôn mặt rõ nét.',
              })
            }
            onRemovePortrait={() => updateDraft({ portraitUri: null })}
          />
        )}

        {draft.step === 2 && (
          <DegreeStep
            degreeUri={draft.degreeUri}
            onCaptureDegree={() =>
              void handleCapture('degreeUri', {
                mode: 'document',
                facing: 'back',
                instruction: 'Chụp rõ nét Bằng tốt nghiệp chuyên môn.',
              })
            }
            onRemoveDegree={() => updateDraft({ degreeUri: null })}
            yearsOfExp={draft.yearsOfExp}
            onYearsOfExpChange={(yearsOfExp) => updateDraft({ yearsOfExp })}
          />
        )}

        {draft.step === 3 && (
          <GphnStep
            hasGphn={draft.hasGphn}
            onHasGphnToggle={(hasGphn) => updateDraft({ hasGphn })}
            gphnUri={draft.gphnUri}
            onCaptureGphn={() =>
              void handleCapture('gphnUri', {
                mode: 'document',
                facing: 'back',
                instruction: 'Chụp rõ nét Giấy phép hành nghề (GPHN).',
              })
            }
            onRemoveGphn={() => updateDraft({ gphnUri: null })}
            gphnNumber={draft.gphnNumber}
            onGphnNumberChange={(gphnNumber) => updateDraft({ gphnNumber })}
            gphnIssuedDate={draft.gphnIssuedDate}
            onGphnIssuedDateChange={(gphnIssuedDate) => updateDraft({ gphnIssuedDate })}
            gphnExpiryDate={draft.gphnExpiryDate}
            onGphnExpiryDateChange={(gphnExpiryDate) => updateDraft({ gphnExpiryDate })}
            gphnAuthority={draft.gphnAuthority}
            onGphnAuthorityChange={(gphnAuthority) => updateDraft({ gphnAuthority })}
            scopeOfPractice={draft.scopeOfPractice}
            onScopeOfPracticeChange={(scopeOfPractice) => updateDraft({ scopeOfPractice })}
          />
        )}

        {draft.step === 4 && (
          <SupplementStep
            isRetired={draft.isRetired}
            onIsRetiredChange={(isRetired) => updateDraft({ isRetired })}
            retirementUri={draft.retirementUri}
            onCaptureRetirement={() =>
              void handleCapture('retirementUri', {
                mode: 'document',
                facing: 'back',
                instruction: 'Chụp rõ nét Quyết định nghỉ hưu / Sổ hưu trí.',
              })
            }
            onRemoveRetirement={() => updateDraft({ retirementUri: null })}
          />
        )}

        {draft.step === 5 && (
          <ReviewStep
            draft={draft}
            onGoToStep={(stepIndex) => updateDraft({ step: stepIndex })}
            onSubmitSuccess={async (profile, credentials) => {
              await clearOnboardingDraft();
              await updateProfile(profile, credentials);
              navigation.replace('PendingApproval');
            }}
          />
        )}
      </ScrollView>

      {/* Footer navigation actions (Steps 0 - 4) */}
      {draft.step < STEPS.length - 1 ? (
        <View style={styles.footerBar}>
          {draft.step > 0 ? (
            <AppButton
              label="Quay lại"
              variant="secondary"
              onPress={handleBack}
              style={styles.footerBackBtn}
            />
          ) : (
            <View style={styles.footerSpacer} />
          )}

          <AppButton
            label="Tiếp theo"
            onPress={handleNext}
            disabled={!canProceed()}
            style={styles.footerNextBtn}
            testID="btn-wizard-next"
          />
        </View>
      ) : null}

      {/* Modal xác nhận Hủy tạo hồ sơ */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hủy tạo hồ sơ eKYC?</Text>
            <Text style={styles.modalMessage}>
              Mọi dữ liệu bạn vừa nhập và các hình ảnh chụp tạm thời sẽ bị xóa khỏi máy. Bạn sẽ cần bắt đầu lại từ đầu vào lần đăng nhập tới.
            </Text>

            <View style={styles.modalActions}>
              <AppButton
                label="Tiếp tục làm hồ sơ"
                variant="secondary"
                onPress={() => setShowCancelModal(false)}
                style={styles.modalActionBtn}
              />
              <AppButton
                label="Xác nhận hủy"
                variant="danger"
                onPress={() => void handleCancelRegistration()}
                style={styles.modalActionBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.canvas,
  },
  loadingText: {
    fontSize: tokens.typography.fontSizeBase,
    color: tokens.colors.inkSecondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.paddingBase,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.paper,
  },
  titleColumn: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: tokens.typography.fontSizeLarge,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  topBarSubtitle: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  cancelDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
  },
  cancelDraftText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeCurrent: {
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJade,
  },
  stepBadgeDone: {
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJade,
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  stepBadgeTextCurrent: {
    color: '#FFFFFF',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: tokens.colors.borderHairline,
    marginHorizontal: 4,
  },
  stepConnectorDone: {
    backgroundColor: tokens.colors.brandJade,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.paddingBase,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: tokens.spacing.paddingBase,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.paper,
  },
  footerBackBtn: {
    flex: 1,
    minHeight: tokens.spacing.touchTargetMin,
  },
  footerSpacer: {
    flex: 1,
  },
  footerNextBtn: {
    flex: 1.5,
    minHeight: tokens.spacing.touchTargetMin,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 22,
    gap: 14,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  modalMessage: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalActionBtn: {
    flex: 1,
    minHeight: tokens.spacing.touchTargetMin,
  },
});
