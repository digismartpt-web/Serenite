import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  currentStep: number;  // 1 à totalSteps
  totalSteps?: number;  // défaut 5
}

/**
 * ProgressBar
 * Affichée dans le header bleu de l'onboarding.
 * Segmenté en N barres :
 *   - Passées  : vert  #1D9E75
 *   - Active   : blanc #FFFFFF
 *   - Futures  : blanc semi-transparent
 */
export default function ProgressBar({ currentStep, totalSteps = 5 }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`Étape ${currentStep} sur ${totalSteps}`}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const completed = step < currentStep;
        const active    = step === currentStep;

        return (
          <View
            key={step}
            style={[
              styles.segment,
              completed && styles.completed,
              active    && styles.active,
              !completed && !active && styles.future,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  completed: {
    backgroundColor: '#1D9E75',
  },
  active: {
    backgroundColor: '#FFFFFF',
  },
  future: {
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
});
