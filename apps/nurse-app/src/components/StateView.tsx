import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../styles/tokens';
import { AppButton } from './AppButton';
import { CareNestLogoMark } from './CareNestLogo';

interface StateViewProps {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const StateView: React.FC<StateViewProps> = ({
  kind,
  title,
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={[styles.card, kind === 'error' && styles.errorCard]}>
      {kind === 'loading' && (
        <View style={styles.loadingWrap}>
          <CareNestLogoMark size={44} style={styles.logoMark} />
          <ActivityIndicator size="small" color={tokens.colors.brandJade} style={styles.spinner} />
        </View>
      )}
      <Text style={[styles.title, kind === 'error' && styles.errorTitle]}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          onPress={onAction}
          variant={kind === 'error' ? 'primary' : 'secondary'}
          style={styles.action}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 20,
    alignItems: 'center',
  },
  errorCard: {
    borderColor: '#FCA5A5',
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  loadingWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoMark: {
    marginBottom: 10,
  },
  spinner: {
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  errorTitle: {
    color: tokens.colors.alertCrimson,
  },
  message: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  action: {
    marginTop: 16,
    alignSelf: 'stretch',
  },
});

