import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
// Web-compatible secure storage
const SecureStore = typeof window !== 'undefined' && window.localStorage
  ? { setItemAsync: async (k: string, v: string) => { try { localStorage.setItem(k, v) } catch(e) {} } }
  : require('expo-secure-store');

import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTranslation } from '../../i18n/useTranslation';
import { API_URL as API_BASE } from '../constants/api';

// ─── Config ────────────────────────────────────────────────────
const SECURE_TOKEN_KEY = 'serenite_auth_token';

// ─── Types ─────────────────────────────────────────────────────

interface ConsentState {
  cgu:          boolean;
  dataProcess:  boolean;
  childrenData: boolean;
  newsletter:   boolean;
}

type RegisterError =
  | { type: 'email_exists' }
  | { type: 'network' }
  | { type: 'server'; message: string }
  | { type: 'missing_data' };

// ─── Écran step 5 ──────────────────────────────────────────────

export default function Step5Screen() {
  const router           = useRouter();
  const { data, reset }  = useOnboarding();
  const { t } = useTranslation();

  const [consents, setConsents] = useState<ConsentState>({
    cgu:          false,
    dataProcess:  false,
    childrenData: false,
    newsletter:   false,
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<RegisterError | null>(null);

  // Les 3 consentements obligatoires
  const mandatoryOk = consents.cgu && consents.dataProcess && consents.childrenData;

  function toggle(key: keyof ConsentState) {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
    setError(null);
  }

  // ── Vérification des données collectées ───────────────────
  function validateData(): boolean {
    return !!(
      data.firstName &&
      data.lastName &&
      data.email &&
      data.phone &&
      data.birthDate &&
      data.parentType &&
      data.parentStatus &&
      data.pin
    );
  }

  // ── Appel API ─────────────────────────────────────────────
  async function handleRegister() {
    if (!mandatoryOk) return;

    if (!validateData()) {
      setError({ type: 'missing_data' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName:     data.firstName,
          lastName:      data.lastName,
          email:         data.email,
          phone:         data.phone,
          address:       data.address,
          birthDate:     data.birthDate?.toISOString().split('T')[0],
          role:          'parent',
          parentType:    data.parentType,
          status:        data.parentStatus,
          childrenCount: data.childrenCount,
          pin:           data.pin,
          language:      data.language,
          // Consentements RGPD
          consentCgu:        consents.cgu,
          consentData:       consents.dataProcess,
          consentChildren:   consents.childrenData,
          consentNewsletter: consents.newsletter,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError({ type: 'email_exists' });
        } else {
          setError({ type: 'server', message: body.error ?? 'Erreur inconnue' });
        }
        return;
      }

      // ── Succès ────────────────────────────────────────────
      // Stocker le JWT de manière sécurisée
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, body.token);

      // Effacer les données d'onboarding de la mémoire
      reset();

      // Vérifier s'il y a une invitation en attente (lien coparent)
      const pendingInvite = typeof window !== 'undefined'
        ? (() => { try { return localStorage.getItem('serenite_pending_invite') } catch { return null } })()
        : null;
      if (pendingInvite) {
        try { localStorage.removeItem('serenite_pending_invite'); } catch {}
        const target = `/invite/join?token=${pendingInvite}`;
        setTimeout(() => {
          try { router.replace(target); } catch {}
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/invite/join')) {
            window.location.href = target;
          }
        }, 100);
      } else {
        setTimeout(() => {
          try { router.replace('/(tabs)/home'); } catch {}
        }, 100);
      }
    } catch {
      setError({ type: 'network' });
    } finally {
      setLoading(false);
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>{t('step5.title')}</Text>
      <Text style={styles.pageSubtitle}>
        {t('step5.subtitle')}
      </Text>

      {/* ─ Consentements obligatoires ─ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('step5.mandatory')}</Text>

        <ConsentRow
          checked={consents.cgu}
          onToggle={() => toggle('cgu')}
          title={t('step5.cgu')}
          description={t('step5.cguDesc')}
          link={t('step5.readCgu')}
          onLinkPress={() => { /* TODO: ouvrir WebBrowser */ }}
          required
        />

        <ConsentRow
          checked={consents.dataProcess}
          onToggle={() => toggle('dataProcess')}
          title={t('step5.dataPrivacy')}
          description={t('step5.dataPrivacyDesc')}
          link={t('step5.readPolicy')}
          onLinkPress={() => { /* TODO */ }}
          required
        />

        <ConsentRow
          checked={consents.childrenData}
          onToggle={() => toggle('childrenData')}
          title={t('step5.childrenData')}
          description={t('step5.childrenDataDesc')}
          required
        />
      </View>

      {/* ─ Consentement optionnel ─ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('optional')}</Text>

        <ConsentRow
          checked={consents.newsletter}
          onToggle={() => toggle('newsletter')}
          title={t('step5.newsletter')}
          description={t('step5.newsletterDesc')}
        />
      </View>

      {/* ─ Message d'erreur ─ */}
      {error && <ErrorBlock error={error} onLoginPress={() => router.push('/auth/login')} />}

      {/* ─ Bouton créer le compte ─ */}
      <TouchableOpacity
        style={[
          styles.registerBtn,
          (!mandatoryOk || loading) && styles.registerBtnDisabled,
        ]}
        onPress={handleRegister}
        disabled={!mandatoryOk || loading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: !mandatoryOk || loading }}
        accessibilityLabel={t('step5.createAccount')}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.registerBtnText}>{t('step5.createAccount')}</Text>
        )}
      </TouchableOpacity>

      {!mandatoryOk && !loading && (
        <Text style={styles.hintText}>
          {t('step5.consentHint')}
        </Text>
      )}

      {/* Récapitulatif sécurité */}
      <View style={styles.securityRow}>
        <Text style={styles.securityItem}>🔒 {t('step5.encrypted')}</Text>
        <Text style={styles.securityItem}>🇪🇺 {t('step5.gdpr')}</Text>
        <Text style={styles.securityItem}>🚫 {t('step5.noAds')}</Text>
      </View>
    </ScrollView>
  );
}

// ─── ConsentRow ────────────────────────────────────────────────

interface ConsentRowProps {
  checked:     boolean;
  onToggle:    () => void;
  title:       string;
  description: string;
  link?:       string;
  onLinkPress?: () => void;
  required?:   boolean;
}

function ConsentRow({
  checked, onToggle, title, description,
  link, onLinkPress, required,
}: ConsentRowProps) {
  return (
    <TouchableOpacity
      style={[styles.consentRow, checked && styles.consentRowChecked]}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>

      <View style={styles.consentTexts}>
        <Text style={styles.consentTitle}>
          {title}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        <Text style={styles.consentDesc}>{description}</Text>
        {link && onLinkPress && (
          <TouchableOpacity onPress={onLinkPress} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.consentLink}>{link} →</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── ErrorBlock ────────────────────────────────────────────────

function ErrorBlock({
  error,
  onLoginPress,
}: { error: RegisterError; onLoginPress: () => void }) {
  const { t } = useTranslation();
  const messages: Record<RegisterError['type'], React.ReactNode> = {
    email_exists: (
      <>
        <Text style={styles.errorText}>
          {t('step5.err.emailExists')}{' '}
        </Text>
        <Text style={styles.errorLink} onPress={onLoginPress}>
          {t('onboarding.login')}
        </Text>
      </>
    ),
    network: (
      <Text style={styles.errorText}>
        Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.
      </Text>
    ),
    server: (
      <Text style={styles.errorText}>
        {'message' in error ? error.message : t('step5.err.server')}
      </Text>
    ),
    missing_data: (
      <Text style={styles.errorText}>
        {t('step5.err.missingData')}
      </Text>
    ),
  };

  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <View style={styles.errorContent}>{messages[error.type]}</View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
    gap: 20,
  },
  pageTitle: {
    fontSize:   26,
    fontWeight: '800',
    color:      '#1A3A5C',
    marginTop:  8,
  },
  pageSubtitle: {
    fontSize:   14,
    color:      '#5A7499',
    lineHeight: 20,
    marginTop:  -8,
  },

  // ── Section ───────────────────────────────────────────────────
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize:   12,
    fontWeight: '700',
    color:      '#8A9BB0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Consentements ─────────────────────────────────────────────
  consentRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            12,
    padding:        14,
    backgroundColor: '#FFFFFF',
    borderRadius:   10,
    borderWidth:    1.5,
    borderColor:    '#D8DCE6',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  consentRowChecked: {
    borderColor:     '#1D9E75',
    backgroundColor: '#FAFFFE',
  },
  checkbox: {
    width:          22,
    height:         22,
    borderRadius:   6,
    borderWidth:    2,
    borderColor:    '#D8DCE6',
    justifyContent: 'center',
    alignItems:     'center',
    marginTop:      1,
    flexShrink:     0,
  },
  checkboxChecked: {
    backgroundColor: '#1D9E75',
    borderColor:     '#1D9E75',
  },
  checkmark: {
    color:      '#FFFFFF',
    fontSize:   13,
    fontWeight: '800',
    lineHeight: 16,
  },
  consentTexts: {
    flex: 1,
    gap:  3,
  },
  consentTitle: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#1A3A5C',
    lineHeight: 20,
  },
  consentDesc: {
    fontSize:   13,
    color:      '#5A7499',
    lineHeight: 18,
  },
  consentLink: {
    fontSize:   13,
    color:      '#1A3A5C',
    fontWeight: '600',
    marginTop:  2,
  },
  required: {
    color: '#E53E3E',
  },

  // ── Erreurs ───────────────────────────────────────────────────
  errorBanner: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    backgroundColor: '#FFF5F5',
    borderRadius:   10,
    padding:        14,
    gap:            10,
    borderWidth:    1,
    borderColor:    '#FEB2B2',
  },
  errorIcon: {
    fontSize:  16,
    marginTop: 1,
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap:      'wrap',
  },
  errorText: {
    fontSize:   13,
    color:      '#C53030',
    lineHeight: 18,
  },
  errorLink: {
    fontSize:   13,
    color:      '#1A3A5C',
    fontWeight: '700',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },

  // ── Bouton inscription ────────────────────────────────────────
  registerBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius:    10,
    paddingVertical: 17,
    alignItems:      'center',
    marginTop:       4,
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  registerBtnDisabled: {
    backgroundColor: '#A0AEC0',
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  registerBtnText: {
    color:      '#FFFFFF',
    fontSize:   17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hintText: {
    fontSize:  13,
    color:     '#8A9BB0',
    textAlign: 'center',
    marginTop: -8,
  },

  // ── Note sécurité ─────────────────────────────────────────────
  securityRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            16,
    flexWrap:       'wrap',
    marginTop:      4,
  },
  securityItem: {
    fontSize:   12,
    color:      '#8A9BB0',
  },
});
