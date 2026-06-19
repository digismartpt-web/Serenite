import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';

const SecureStore = Platform.OS === 'web'
  ? {
      setItemAsync: async (k: string, v: string): Promise<void> => { try { localStorage.setItem(k, v) } catch { } },
    }
  : require('expo-secure-store');

import { API_BASE } from '../constants/api';
const SECURE_TOKEN_KEY='serenite_auth_token';

type ForgotStep = 'idle' | 'email-sent' | 'done';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [pin,   setPin]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── État du flux « PIN oublié » ─────────────────────────────
  const [forgotMode, setForgotMode]     = useState(false);
  const [forgotStep, setForgotStep]     = useState<ForgotStep>('idle');
  const [forgotEmail, setForgotEmail]   = useState('');
  const [resetToken, setResetToken]     = useState('');
  const [resetCode, setResetCode]       = useState('');
  const [newPin, setNewPin]             = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError]   = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !pin) {
      setError(t('auth.login.err.empty'));
      return;
    }
    if (pin.length !== 6) {
      setError(t('auth.login.err.pinLength'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.toLowerCase().trim(), pin }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError(t('auth.login.err.invalid'));
        } else {
          setError(body.error ?? t('auth.login.err.server'));
        }
        return;
      }

      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, body.token);
      // Vérifier s'il y a une invitation en attente
      const pendingInvite = typeof window !== 'undefined'
        ? (() => { try { return localStorage.getItem('serenite_pending_invite') } catch { return null } })()
        : null;
      if (pendingInvite) {
        try { localStorage.removeItem('serenite_pending_invite'); } catch {}
        const target = `/invite/join?token=${pendingInvite}`;
        router.replace(target);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/invite/join')) {
          window.location.href = target;
        }
      } else {
        router.replace('/(tabs)/home');
      }
    } catch {
      setError(t('auth.login.err.server'));
    } finally {
      setLoading(false);
    }
  }

  // ── Envoyer le code de réinitialisation ─────────────────────
  async function handleForgotPinSend() {
    if (!forgotEmail.trim()) {
      setForgotError(t('auth.login.forgotPinEmailRequired'));
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-pin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: forgotEmail.toLowerCase().trim() }),
      });

      const body = await res.json();
      if (!res.ok) {
        setForgotError(body.error ?? t('auth.login.err.server'));
        return;
      }

      setResetToken(body.resetToken || '');
      setForgotStep('email-sent');
      setForgotSuccess(t('auth.login.forgotPinSent'));
    } catch {
      setForgotError(t('auth.login.err.server'));
    } finally {
      setForgotLoading(false);
    }
  }

  // ── Réinitialiser le PIN ────────────────────────────────────
  async function handleResetPin() {
    if (!resetCode || resetCode.length !== 6) {
      setForgotError(t('auth.login.resetPinCodeRequired'));
      return;
    }
    if (!newPin || newPin.length !== 6) {
      setForgotError(t('auth.login.err.pinLength'));
      return;
    }
    if (newPin !== confirmNewPin) {
      setForgotError(t('auth.login.resetPinMismatch'));
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-pin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          resetToken,
          code:   resetCode,
          newPin,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setForgotError(body.error ?? t('auth.login.err.server'));
        return;
      }

      setForgotStep('done');
      setForgotSuccess(t('auth.login.resetPinSuccess'));
    } catch {
      setForgotError(t('auth.login.err.server'));
    } finally {
      setForgotLoading(false);
    }
  }

  // ── Retour au login ─────────────────────────────────────────
  function handleBackToLogin() {
    setForgotMode(false);
    setForgotStep('idle');
    setForgotEmail('');
    setResetToken('');
    setResetCode('');
    setNewPin('');
    setConfirmNewPin('');
    setForgotError(null);
    setForgotSuccess(null);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Retour */}
        <TouchableOpacity style={styles.backBtn} onPress={() => forgotMode ? handleBackToLogin() : router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← {forgotMode ? t('back') : t('back')}</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🕊️</Text>
          </View>
          <Text style={styles.title}>
            {forgotMode ? t('auth.login.forgotPin') : t('auth.login.title')}
          </Text>
          <Text style={styles.subtitle}>
            {forgotMode
              ? (forgotStep === 'idle'
                  ? t('auth.login.forgotPinSubtitle')
                  : forgotStep === 'email-sent'
                    ? t('auth.login.forgotPinEnterCode')
                    : '')
              : t('auth.login.subtitle')
            }
          </Text>
        </View>

        {/* ── Mode PIN oublié ────────────────────────────────── */}
        {forgotMode ? (
          <View style={styles.form}>
            {forgotStep === 'idle' && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.login.email')}</Text>
                  <TextInput
                    style={styles.input}
                    value={forgotEmail}
                    onChangeText={(v) => { setForgotEmail(v); setForgotError(null); }}
                    placeholder={t('auth.login.emailPH')}
                    placeholderTextColor="#A0AEC0"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={handleForgotPinSend}
                    accessibilityLabel={t('auth.login.email')}
                  />
                </View>

                {forgotError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>⚠️  {forgotError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, (forgotLoading || !forgotEmail) && styles.primaryBtnDisabled]}
                  onPress={handleForgotPinSend}
                  disabled={forgotLoading || !forgotEmail}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.login.forgotPinSendCode')}
                >
                  {forgotLoading
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.primaryBtnText}>{t('auth.login.forgotPinSendCode')}</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {forgotStep === 'email-sent' && (
              <>
                {forgotSuccess && (
                  <View style={styles.successBanner}>
                    <Text style={styles.successText}>✅  {forgotSuccess}</Text>
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.login.resetPinCode')}</Text>
                  <TextInput
                    style={styles.input}
                    value={resetCode}
                    onChangeText={(v) => { setResetCode(v.replace(/\D/g, '').slice(0, 6)); setForgotError(null); }}
                    placeholder="000000"
                    placeholderTextColor="#A0AEC0"
                    keyboardType="number-pad"
                    maxLength={6}
                    returnKeyType="next"
                    accessibilityLabel={t('auth.login.resetPinCode')}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.login.resetPinNewPin')}</Text>
                  <TextInput
                    style={styles.input}
                    value={newPin}
                    onChangeText={(v) => { setNewPin(v.replace(/\D/g, '').slice(0, 6)); setForgotError(null); }}
                    placeholder="••••••"
                    placeholderTextColor="#A0AEC0"
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    returnKeyType="next"
                    accessibilityLabel={t('auth.login.resetPinNewPin')}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.login.resetPinConfirmPin')}</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmNewPin}
                    onChangeText={(v) => { setConfirmNewPin(v.replace(/\D/g, '').slice(0, 6)); setForgotError(null); }}
                    placeholder="••••••"
                    placeholderTextColor="#A0AEC0"
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={handleResetPin}
                    accessibilityLabel={t('auth.login.resetPinConfirmPin')}
                  />
                </View>

                {forgotError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>⚠️  {forgotError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, (forgotLoading || !resetCode || !newPin || !confirmNewPin) && styles.primaryBtnDisabled]}
                  onPress={handleResetPin}
                  disabled={forgotLoading || !resetCode || !newPin || !confirmNewPin}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.login.resetPinBtn')}
                >
                  {forgotLoading
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.primaryBtnText}>{t('auth.login.resetPinBtn')}</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleForgotPinSend()} activeOpacity={0.7}>
                  <Text style={styles.resendLink}>{t('auth.login.forgotPinResend')}</Text>
                </TouchableOpacity>
              </>
            )}

            {forgotStep === 'done' && (
              <>
                {forgotSuccess && (
                  <View style={styles.successBanner}>
                    <Text style={styles.successText}>✅  {forgotSuccess}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleBackToLogin}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>{t('auth.login.resetPinBackToLogin')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          /* ── Mode Login normal ───────────────────────────────── */
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.login.email')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null); }}
                placeholder={t('auth.login.emailPH')}
                placeholderTextColor="#A0AEC0"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                accessibilityLabel={t('auth.login.email')}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.login.pinCode')}</Text>
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={(v) => { setPin(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                placeholder={t('auth.login.pinPH')}
                placeholderTextColor="#A0AEC0"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel={t('auth.login.pinCode')}
              />
            </View>

            {/* Lien « PIN oublié ? » */}
            <TouchableOpacity
              onPress={() => { setForgotMode(true); setForgotEmail(email); }}
              activeOpacity={0.7}
              style={styles.forgotPinLink}
            >
              <Text style={styles.forgotPinText}>{t('auth.login.forgotPin')}</Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, (loading || !email || !pin) && styles.primaryBtnDisabled]}
              onPress={handleLogin}
              disabled={loading || !email || !pin}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('auth.login.submit')}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.primaryBtnText}>{t('auth.login.submit')}</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Lien inscription */}
        {!forgotMode && (
          <Text style={styles.hint}>
            {t('auth.login.noAccount')}{' '}
            <Text
              style={styles.hintLink}
              onPress={() => router.replace('/onboarding/step1')}
              accessibilityRole="link"
            >
              {t('auth.login.create')}
            </Text>
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    gap: 28,
  },

  backBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  backBtnText: {
    fontSize:   15,
    color:      '#1A3A5C',
    fontWeight: '600',
  },

  hero: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  logoCircle: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: '#E8F0FE',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    4,
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  logoEmoji: { fontSize: 42 },
  title: {
    fontSize:   28,
    fontWeight: '800',
    color:      '#1A3A5C',
  },
  subtitle: {
    fontSize:  14,
    color:     '#5A7499',
    textAlign: 'center',
  },

  form: { gap: 16 },

  field: { gap: 5 },
  label: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#3A4A5C',
  },
  input: {
    backgroundColor:  '#FFFFFF',
    borderWidth:      1.5,
    borderColor:      '#D8DCE6',
    borderRadius:     9,
    paddingVertical:  13,
    paddingHorizontal: 14,
    fontSize:         16,
    color:            '#1A202C',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },

  forgotPinLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotPinText: {
    fontSize:   13,
    color:      '#1A3A5C',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  resendLink: {
    fontSize:   13,
    color:      '#1A3A5C',
    fontWeight: '600',
    textAlign:  'center',
    textDecorationLine: 'underline',
    marginTop:  -4,
  },

  errorBanner: {
    backgroundColor: '#FFF5F5',
    borderRadius:    10,
    padding:         14,
    borderWidth:     1,
    borderColor:     '#FEB2B2',
  },
  errorText: {
    fontSize:   13,
    color:      '#C53030',
    lineHeight: 18,
  },

  successBanner: {
    backgroundColor: '#F0FFF4',
    borderRadius:    10,
    padding:         14,
    borderWidth:     1,
    borderColor:     '#9AE6B4',
  },
  successText: {
    fontSize:   13,
    color:      '#276749',
    lineHeight: 18,
  },

  primaryBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius:    10,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       4,
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  primaryBtnDisabled: {
    backgroundColor: '#A0AEC0',
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  primaryBtnText: {
    color:      '#FFFFFF',
    fontSize:   17,
    fontWeight: '700',
  },

  hint: {
    fontSize:  14,
    color:     '#8A9BB0',
    textAlign: 'center',
  },
  hintLink: {
    color:      '#1A3A5C',
    fontWeight: '700',
  },
});
