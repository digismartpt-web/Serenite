import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
const SecureStore = typeof window !== 'undefined' && window.localStorage
  ? { getItemAsync: async (k) => { try { return localStorage.getItem(k) } catch(e) { return null } }, setItemAsync: async (k, v) => { try { localStorage.setItem(k, v) } catch(e) {} } }
  : require('expo-secure-store');
const LocalAuthentication = Platform.OS === 'web'
  ? null
  : require('expo-local-authentication');

import { useOnboarding } from '../../contexts/OnboardingContext';
import CodeInput         from '../../components/invite/CodeInput';
import { useTranslation } from '../../i18n/useTranslation';

// ─── Clés SecureStore ─────────────────────────────────────────
const SECURE_PIN_KEY        = 'serenite_biometric_pin';
const SECURE_BIOMETRICS_KEY = 'serenite_biometrics_enabled';

// ─── Types ────────────────────────────────────────────────────
type Phase = 'create' | 'confirm' | 'biometrics';

export default function Step4Screen() {
  const router          = useRouter();
  const { patch }       = useOnboarding();
  const { t }           = useTranslation();

  const [phase,       setPhase]       = useState<Phase>('create');
  const [firstPin,    setFirstPin]    = useState('');
  const [confirmKey,  setConfirmKey]  = useState(0);   // force re-mount CodeInput
  const [error,       setError]       = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType,       setBiometricType]       = useState<string>('biométrie');

  // Animation d'erreur (shake)
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Vérifier la disponibilité biométrique ──────────────────
  useEffect(() => {
    if (!LocalAuthentication) return;
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        setBiometricsAvailable(true);

        // Déterminer le type de biométrie disponible
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('empreinte digitale');
        }
      }
    })();
  }, []);

  // ── Animation de secousse ──────────────────────────────────
  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  // ── Phase 1 : création du PIN ──────────────────────────────
  function handlePinCreated(pin: string) {
    setFirstPin(pin);
    setError(null);
    setPhase('confirm');
  }

  // ── Phase 2 : confirmation du PIN ─────────────────────────
  function handlePinConfirmed(confirmedPin: string) {
    if (confirmedPin !== firstPin) {
      setError(t('step4.mismatch'));
      shake();
      // Réinitialiser uniquement la saisie de confirmation
      setConfirmKey((k) => k + 1);
      return;
    }

    setError(null);
    // Stocker le PIN dans le contexte (mémoire uniquement, jamais AsyncStorage)
    patch({ pin: firstPin });

    if (biometricsAvailable) {
      setPhase('biometrics');
    } else {
      router.push('/onboarding/step5');
    }
  }

  // ── Phase 3 : activation biométrie ────────────────────────
  const handleEnableBiometrics = useCallback(async () => {
    if (!LocalAuthentication) { router.push('/onboarding/step5'); return; }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:  t('step4.pinPrompt', { type: biometricType }),
        fallbackLabel:  t('step4.pinFallback'),
        cancelLabel:    'Annuler',
      });

      if (result.success) {
        // Stocker le PIN chiffré dans SecureStore (uniquement si biométrie activée)
        await SecureStore.setItemAsync(SECURE_PIN_KEY, firstPin);
        await SecureStore.setItemAsync(SECURE_BIOMETRICS_KEY, 'true');
        patch({ biometricsEnabled: true });
      }
    } catch {
      // L'utilisateur peut toujours continuer sans biométrie
    }

    router.push('/onboarding/step5');
  }, [firstPin, biometricType]);

  function handleSkipBiometrics() {
    router.push('/onboarding/step5');
  }

  function handleRestartCreation() {
    setFirstPin('');
    setError(null);
    setCurrentCode('');
    setPhase('create');
    setConfirmKey((k) => k + 1);
  }

  // ─── Rendu ─────────────────────────────────────────────────

  // Phase biométrie
  if (phase === 'biometrics') {
    return (
      <View style={styles.container}>
        <View style={styles.biometricsCard}>
          <Text style={styles.biometricsEmoji}>
            {biometricType === 'Face ID' ? '🔐' : '👆'}
          </Text>
          <Text style={styles.biometricsTitle}>
            {t('step4.enableBiometrics', { type: biometricType })}
          </Text>
          <Text style={styles.biometricsSubtitle}>
            {t('step4.biometricsDesc')}
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleEnableBiometrics}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('step4.biometricsBtn', { type: biometricType })}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={handleSkipBiometrics}
            activeOpacity={0.75}
          >
            <Text style={styles.ghostBtnText}>{t('step4.skipBiometrics')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Phase création / confirmation
  const isConfirm = phase === 'confirm';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <Text style={styles.pageTitle}>
          {isConfirm ? t('step4.confirmTitle') : t('step4.title')}
        </Text>
        <Text style={styles.pageSubtitle}>
          {isConfirm
            ? t('step4.confirmInstr')
            : t('step4.instruction')}
        </Text>
      </View>

      {/* Cases de saisie */}
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <CodeInput
          key={isConfirm ? `confirm-${confirmKey}` : 'create'}
          length={6}
          secure
          onComplete={isConfirm ? handlePinConfirmed : handlePinCreated}
          onChangeCode={setCurrentCode}
          accentColor={error ? '#E53E3E' : '#1A3A5C'}
          disabled={false}
        />
      </Animated.View>

      {/* Indicateurs de dots de progression */}
      <View style={styles.phaseIndicators}>
        <View style={[styles.phaseStep, styles.phaseStepDone]} />
        <View style={[styles.phaseStep, isConfirm && styles.phaseStepActive]} />
      </View>

      {/* Erreur */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Bouton Continuer — visible quand les 6 chiffres sont saisis */}
      {currentCode.length === 6 && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={isConfirm ? () => handlePinConfirmed(currentCode) : () => handlePinCreated(currentCode)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{t('continue')}</Text>
        </TouchableOpacity>
      )}

      {/* Bouton "Recommencer" en phase confirmation */}
      {isConfirm && (
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={handleRestartCreation}
          activeOpacity={0.75}
        >
          <Text style={styles.ghostBtnText}>{t('step4.chooseOther')}</Text>
        </TouchableOpacity>
      )}

      {/* Note sécurité */}
      <View style={styles.securityNote}>
        <Text style={styles.securityNoteText}>
          🛡️  {t('step4.securityNote')}
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
    gap: 28,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  lockEmoji: {
    fontSize: 52,
  },
  pageTitle: {
    fontSize:   24,
    fontWeight: '800',
    color:      '#1A3A5C',
    textAlign:  'center',
  },
  pageSubtitle: {
    fontSize:   14,
    color:      '#5A7499',
    textAlign:  'center',
    lineHeight: 20,
  },

  // ── Indicateurs de phase ──────────────────────────────────
  phaseIndicators: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     -8,
  },
  phaseStep: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#D8DCE6',
  },
  phaseStepDone: {
    backgroundColor: '#1D9E75',
  },
  phaseStepActive: {
    backgroundColor: '#1A3A5C',
  },

  // ── Erreur ────────────────────────────────────────────────
  errorBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: '#FFF5F5',
    borderRadius:   10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap:            8,
    borderWidth:    1,
    borderColor:    '#FEB2B2',
    alignSelf:      'stretch',
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex:       1,
    fontSize:   13,
    color:      '#C53030',
    lineHeight: 18,
  },

  // ── Boutons ───────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius:    10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems:      'center',
    alignSelf:       'stretch',
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  primaryBtnText: {
    color:      '#FFFFFF',
    fontSize:   17,
    fontWeight: '700',
  },
  ghostBtn: {
    paddingVertical:   12,
    paddingHorizontal: 24,
    borderRadius:      10,
    borderWidth:       1.5,
    borderColor:       '#D8DCE6',
    alignItems:        'center',
    alignSelf:         'stretch',
  },
  ghostBtnText: {
    fontSize:   15,
    color:      '#5A7499',
    fontWeight: '600',
  },

  // ── Biométrie ────────────────────────────────────────────
  biometricsCard: {
    alignItems: 'center',
    padding:    32,
    gap:        16,
    flex:       1,
    justifyContent: 'center',
  },
  biometricsEmoji: {
    fontSize: 72,
  },
  biometricsTitle: {
    fontSize:   24,
    fontWeight: '800',
    color:      '#1A3A5C',
    textAlign:  'center',
  },
  biometricsSubtitle: {
    fontSize:   14,
    color:      '#5A7499',
    textAlign:  'center',
    lineHeight: 22,
    marginBottom: 8,
  },

  // ── Note sécurité ─────────────────────────────────────────
  securityNote: {
    backgroundColor: '#EDF7F3',
    borderRadius:    10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf:       'stretch',
  },
  securityNoteText: {
    fontSize:   13,
    color:      '#276749',
    textAlign:  'center',
    lineHeight: 18,
  },
});
