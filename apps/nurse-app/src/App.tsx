import React from 'react';
import { SafeAreaView, Text, View, StyleSheet } from 'react-native';
import { tokens } from './styles/tokens';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>HealthCareSystem — Nurse Mobile App</Text>
        <Text style={styles.subtitle}>Elder-Friendly Typography (16–18pt) & Touch Targets Scaffolded</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: tokens.typography.fontSizeBase,
    color: tokens.colors.textMuted,
  },
});

