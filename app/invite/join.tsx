import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import CodeInput from '../../components/invite/CodeInput';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type State = 'idle' | 'loading' | 'success' | 'error';

export default function JoinScreen() {
  const router     = useRouter();
  const { token: authToken } = useAuth();
  const { t } = useTranslation();
  // Le token peut être passé via deep link (serenite://join/[token])
  const { token: deepLinkToken } = useLocalSearchParams<{ token?: string }>();

  const [code,     setCode]     = useState('');
  const [state,    setState]    = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Animation pour le feedback de succès
  const successAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;

  // Si on arrive via deep link avec un token, on tente directement
  useEffect(() => {
    if (deepLinkToken) {
      acceptWithToken(deepLinkToken);
    }
  }, [deepLinkToken]);

  // ── Accepter avec un code saisi ──────────────────────────────
  async function acceptWithCode(enteredCode: string) {
    await doAccept({ code: enteredCode });
  }

  // ── Accepter avec un token (deep link) ───────────────────────
  async function acceptWithToken(token: string) {
    await doAccept({ token });
  }

  const doAccept = useCallback(async (body: { code?: string; token?: string }) => {
    setState('loading');
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/invitations/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? t('invite.error.connection'));
        setState('error');

        // Petite vibration d'erreur (animation shake)
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.04, duration: 80, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.02, duration: 80, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
        ]).start();
        return;
      }

      // ── Succès ──
      setState('success');
      Animated.sequence([
        Animated.timing(successAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(1200),
      ]).start(() => {
        router.replace('/invite/children');
      });
    } catch {
      setErrorMsg(t('invite.error.network'));
      setState('error');
    }
  }, [authToken]);

  // ── Rendu ─────────────────────────────────────────────────────

  if (state === 'success') {
    return (
      <View style={styles.successContainer}>
        <Animated.View
          style={[
            styles.successCircle,
            { opacity: successAnim, transform: [{ scale: successAnim }] },
          ]}
        >
          <Text style={styles.successIcon}>✓</Text>
        </Animated.View>
        <Animated.Text style={[styles.successText, { opacity: successAnim }]}>
          {t('invite.success')}
        </Animated.Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Illustration */}
      <View style={styles.illustration}>
        <Text style={styles.illustrationIcon}>👨‍👩‍👧‍👦</Text>
      </View>

      <Text style={styles.title}>{t('invite.title')}</Text>
      <Text style={styles.subtitle}>
        {t('invite.subtitle')}
      </Text>

      {/* Saisie du code */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <CodeInput
          length={6}
          onComplete={acceptWithCode}
          onChangeCode={setCode}
          disabled={state === 'loading'}
          accentColor="#1A3A5C"
        />
      </Animated.View>

      {/* Message d'erreur */}
      {state === 'error' && errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Bouton de validation */}
      <TouchableOpacity
        style={[
          styles.joinBtn,
          (code.length < 6 || state === 'loading') && styles.joinBtnDisabled,
        ]}
        onPress={() => code.length === 6 && acceptWithCode(code)}
        disabled={code.length < 6 || state === 'loading'}
        activeOpacity={0.8}
      >
        <Text style={styles.joinBtnText}>
          {state === 'loading' ? t('invite.verifying') : t('invite.join')}
        </Text>
      </TouchableOpacity>

      {/* Séparateur */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('invite.or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Accès via lien / QR code */}
      <Text style={styles.alternativeText}>
        {t('invite.alternative')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#F0FFF4',
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#38A169',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  successText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#276749',
  },
  illustration: {
    marginTop: 16,
    marginBottom: 8,
  },
  illustrationIcon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A3A5C',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEB2B2',
    alignSelf: 'stretch',
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#C53030',
    lineHeight: 18,
  },
  joinBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  joinBtnDisabled: {
    backgroundColor: '#A0AEC0',
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 13,
    color: '#A0AEC0',
  },
  alternativeText: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
});
