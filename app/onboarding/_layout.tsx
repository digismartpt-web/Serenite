import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingProvider } from '../../contexts/OnboardingContext';
import ProgressBar from '../../components/onboarding/ProgressBar';

const TOTAL_STEPS = 5;

function extractStep(pathname: string): number {
  const match = pathname.match(/step(\d+)/);
  return match ? Math.min(parseInt(match[1], 10), TOTAL_STEPS) : 1;
}

// ─── Header personnalisé ──────────────────────────────────────

function OnboardingHeader() {
  const router      = useRouter();
  const pathname    = usePathname();
  const insets      = useSafeAreaInsets();
  const currentStep = extractStep(pathname);
  const canGoBack   = currentStep > 1;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {/* Rangée titre + bouton retour */}
      <View style={styles.topRow}>
        {canGoBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Retour"
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backLabel}>Retour</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <Text style={styles.title} accessibilityRole="header">
          Sérénité
        </Text>

        <Text style={styles.stepCounter} accessibilityLabel={`Étape ${currentStep} sur ${TOTAL_STEPS}`}>
          {currentStep}/{TOTAL_STEPS}
        </Text>
      </View>

      {/* Barre de progression */}
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
    </View>
  );
}

// ─── Layout principal ─────────────────────────────────────────

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <View style={styles.root}>
        <OnboardingHeader />
        <Stack
          screenOptions={{
            headerShown:  false,
            animation:    'slide_from_right',
            contentStyle: { backgroundColor: '#F4F6FA' },
          }}
        />
      </View>
    </OnboardingProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  header: {
    backgroundColor: '#1A3A5C',
    paddingBottom: 0,
    ...Platform.select({
      ios: {
        shadowColor:  '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius:  4,
      },
      android: { elevation: 6 },
    }),
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    minHeight: 44,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 2,
    minWidth: 64,
  },
  backChevron: {
    fontSize:   26,
    color:      '#FFFFFF',
    lineHeight: 30,
    marginTop:  -2,
  },
  backLabel: {
    fontSize:   15,
    color:      '#FFFFFF',
    fontWeight: '500',
  },
  backPlaceholder: {
    minWidth: 64,
  },
  title: {
    fontSize:      18,
    fontWeight:    '700',
    color:         '#FFFFFF',
    letterSpacing: 0.3,
  },
  stepCounter: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.70)',
    fontWeight: '600',
    minWidth:   64,
    textAlign:  'right',
  },
});
