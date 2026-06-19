import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Alert, Switch, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useRouter }          from 'expo-router';
import { Ionicons }           from '@expo/vector-icons';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';
const SecureStore = typeof window !== 'undefined' && window.localStorage
  ? { getItemAsync: async (k) => { try { return localStorage.getItem(k) } catch(e) { return null } }, setItemAsync: async (k, v) => { try { localStorage.setItem(k, v) } catch(e) {} } }
  : require('expo-secure-store');
import AsyncStorage            from '@react-native-async-storage/async-storage';

import { useTheme, THEMES, Theme, ThemeMode } from '../context/ThemeContext';
import { useAuth }                           from '../hooks/useAuth';
import { useTranslation }                    from '../../i18n/useTranslation';
import { LANGUAGES }                           from '../../i18n/translations';

import { API_BASE } from '../constants/api';

// ─── Types ────────────────────────────────────────────────────

const PARENT_TYPE_LABELS: Record<string, string> = {
  'papa':       'step3.parentType.papa',
  'maman':      'step3.parentType.maman',
  'beau-pere':  'step3.parentType.stepfather',
  'belle-mere': 'step3.parentType.stepmother',
};

const PARENT_TYPE_EMOJIS: Record<string, string> = {
  'papa':       '👨',
  'maman':      '👩',
  'beau-pere':  '👨‍👧',
  'belle-mere': '👩‍👧',
};

// ─── Composant : ligne de paramètre ───────────────────────────

interface SettingRowProps {
  icon:       string;
  iconColor?: string;
  label:      string;
  value?:     string;
  onPress?:   () => void;
  right?:     React.ReactNode;
  theme:      Theme;
  danger?:    boolean;
}

function SettingRow({ icon, iconColor, label, value, onPress, right, theme, danger }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={[rowStyles.row, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[rowStyles.iconWrapper, { backgroundColor: (iconColor ?? theme.primary) + '18' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor ?? theme.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[rowStyles.label, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
        {value && <Text style={[rowStyles.value, { color: theme.textSecondary }]}>{value}</Text>}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} /> : null)}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  iconWrapper: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  label:  { fontSize: 15, fontWeight: '500' },
  value:  { fontSize: 12, marginTop: 1 },
});

// ─── Composant : en-tête de section ───────────────────────────

function SectionHeader({ title, theme }: { title: string; theme: Theme }) {
  return (
    <Text style={[sectionStyles.header, { color: theme.textSecondary, backgroundColor: theme.background }]}>
      {title.toUpperCase()}
    </Text>
  );
}

const sectionStyles = StyleSheet.create({
  header: { fontSize: 11, fontWeight: '800', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6, letterSpacing: 0.8 },
});

// ─── Écran Paramètres ─────────────────────────────────────────

export default function SettingsScreen() {
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const { theme, themeId, setTheme, themeMode, setThemeMode } = useTheme();
  const { user, token, logout }      = useAuth();
  const { t, lang, setLang } = useTranslation();

  const [notifications, setNotifications] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [updatingTheme, setUpdatingTheme] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  // ── Profil modal (Bug #7) ──────────────────────────────────
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Email verification resend (Bug #8) ─────────────────────
  const [resendingVerification, setResendingVerification] = useState(false);

  // ── Language modal (Bug #13) ───────────────────────────────
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // ── Legal modals (Bug #20, #21) ───────────────────────────
  const [showCguModal, setShowCguModal] = useState(false);
  const [cguContent, setCguContent] = useState('');
  const [loadingCgu, setLoadingCgu] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyContent, setPrivacyContent] = useState('');
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);

  // ── Avatar initiales ───────────────────────────────────────
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  // ── Export RGPD ────────────────────────────────────────────
  async function handleExportData() {
    try {
      const res = await fetch(`${API_BASE}/api/users/export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('settings.serverError'));
      const data = await res.json();
      const json = JSON.stringify(data, null, 2);

      // Sauvegarder dans AsyncStorage pour téléchargement / partage
      await AsyncStorage.setItem('@serenite/rgpd-export', json);

      Alert.alert(
        t('settings.exportSuccess'),
        t('settings.exportSuccessDesc') + '\n\n' +
        `${t('settings.exportDataDesc')} — ${json.length.toLocaleString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'fr-FR')} caractères.`,
        [{ text: t('ok') }]
      );
    } catch (err) {
      Alert.alert(
        t('error'),
        t('settings.exportErrorDesc')
      );
    }
  }

  // ── Déconnexion ────────────────────────────────────────────
  function handleLogout() {
    Alert.alert(
      t('settings.logoutConfirm'),
      t('settings.logoutConfirmDesc'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('settings.logoutAction'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/onboarding/step1');
          },
        },
      ]
    );
  }

  // ── Changer le thème ───────────────────────────────────────
  async function handleThemeChange(id: string) {
    setUpdatingTheme(true);
    setTheme(id);

    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/me`, {
          method:  'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        // On pourrait aussi PATCH le profil pour persister le thème côté serveur
      } catch {}
    }
    setUpdatingTheme(false);
  }

  // ── Espace enfant ──────────────────────────────────────────
  function handleChildSpace() {
    router.push('/child');
  }

  // ── Changer le PIN ──────────────────────────────────────────
  async function handleChangePin() {
    if (!oldPin || !newPin || !confirmPin) {
      Alert.alert(t('error'), 'Veuillez remplir tous les champs.');
      return;
    }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      Alert.alert(t('error'), 'Le nouveau PIN doit comporter 6 chiffres.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert(t('error'), 'Les nouveaux PIN ne correspondent pas.');
      return;
    }
    setChangingPin(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/update-pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin: oldPin, newPin }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur lors du changement de PIN');
      }
      Alert.alert(t('success'), 'Code PIN modifié avec succès.');
      setShowPinModal(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : 'Erreur lors du changement de PIN');
    } finally {
      setChangingPin(false);
    }
  }


  // ── Sauvegarder le profil (Bug #7) ────────────────────────
  async function handleSaveProfile() {
    if (!profileFirstName.trim()) {
      Alert.alert(t('error'), 'Le prénom est requis.');
      return;
    }
    if (!profileEmail.trim()) {
      Alert.alert(t('error'), "L'email est requis.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: profileFirstName.trim(),
          lastName: profileLastName.trim(),
          email: profileEmail.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur lors de la mise à jour du profil');
      }
      Alert.alert(t('success'), 'Profil mis à jour avec succès.');
      setShowProfileModal(false);
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Renvoyer email de vérification (Bug #8) ───────────────
  async function handleResendVerification() {
    setResendingVerification(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erreur lors de l'envoi");
      }
      Alert.alert(t('success'), 'Email de vérification renvoyé avec succès.');
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email");
    } finally {
      setResendingVerification(false);
    }
  }

  // ── Changer la langue (Bug #13) ───────────────────────────
  async function handleSelectLanguage(code: string) {
    await setLang(code as any);
    if (token) {
      try {
        await fetch(`${API_BASE}/api/users/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ language: code }),
        });
      } catch {}
    }
    setShowLanguageModal(false);
  }

  // ── Afficher les CGU (Bug #20) ────────────────────────────
  async function handleShowCgu() {
    setShowCguModal(true);
    if (!cguContent) {
      setLoadingCgu(true);
      try {
        const res = await fetch(`${API_BASE}/api/legal/cgu`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCguContent(data.content || data.text || data.body || JSON.stringify(data, null, 2));
      } catch {
        setCguContent('Impossible de charger les CGU.');
      } finally {
        setLoadingCgu(false);
      }
    }
  }

  // ── Afficher la politique de confidentialité (Bug #21) ────
  async function handleShowPrivacy() {
    setShowPrivacyModal(true);
    if (!privacyContent) {
      setLoadingPrivacy(true);
      try {
        const res = await fetch(`${API_BASE}/api/legal/confidentialite`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setPrivacyContent(data.content || data.text || data.body || JSON.stringify(data, null, 2));
      } catch {
        setPrivacyContent('Impossible de charger la politique de confidentialité.');
      } finally {
        setLoadingPrivacy(false);
      }
    }
  }

  // ── Supprimer le compte ─────────────────────────────────────
  async function handleDeleteAccount() {
    try {
      const res = await fetch(`${API_BASE}/api/users/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur lors de la suppression du compte');
      }
      await logout();
      router.replace('/onboarding/step1');
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : 'Erreur lors de la suppression du compte');
    }
  }

  const adultThemes = Object.values(THEMES).filter((t) => !t.isChildTheme);
  const childThemes = Object.values(THEMES).filter((t) =>  t.isChildTheme);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ─ Header ─ */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ─ Avatar / Profil ─ */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {user ? `${user.firstName} ${user.lastName}` : t('settings.loading')}
            </Text>
            {user?.parentType && (
              <View style={styles.parentTypeBadge}>
                <Text style={{ fontSize: 16 }}>{PARENT_TYPE_EMOJIS[user.parentType] ?? '👤'}</Text>
                <Text style={[styles.parentTypeLabel, { color: theme.primary }]}>
                  {t(PARENT_TYPE_LABELS[user.parentType]) ?? user.parentType}
                </Text>
              </View>
            )}
            <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
              {user?.email ?? ''}
            </Text>
          </View>
          {user && !user.emailVerified && (
            <TouchableOpacity
              style={styles.unverifiedBadge}
              onPress={handleResendVerification}
              disabled={resendingVerification}
            >
              {resendingVerification ? (
                <ActivityIndicator size="small" color="#92400E" />
              ) : (
                <Text style={styles.unverifiedText}>{t('settings.emailUnverifiedBadge')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ─ Compte ─ */}
        <SectionHeader title={t('settings.account')} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="person-outline"
            label={t('settings.editProfile')}
            value={t('settings.editProfileDesc')}
            onPress={() => {
              setProfileFirstName(user?.firstName ?? '');
              setProfileLastName(user?.lastName ?? '');
              setProfileEmail(user?.email ?? '');
              setShowProfileModal(true);
            }}
            theme={theme}
          />
          <SettingRow
            icon="lock-closed-outline"
            label={t('settings.changePin')}
            onPress={() => setShowPinModal(true)}
            theme={theme}
          />
          <SettingRow
            icon="mail-outline"
            label={user?.email ?? ''}
            value={user?.emailVerified ? t('settings.emailVerified') : t('settings.emailUnverified')}
            iconColor={user?.emailVerified ? '#276749' : '#D97706'}
            theme={theme}
          />
        </View>

        {/* ─ Famille ─ */}
        <SectionHeader title={t('settings.family')} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="people-outline"
            label={t('settings.manageFamily')}
            value={t('settings.manageFamilyDesc')}
            onPress={() => router.push('/invite/send')}
            theme={theme}
          />
          <SettingRow
            icon="happy-outline"
            label={t('settings.childSpace')}
            value={t('settings.childSpaceDesc')}
            iconColor="#5B3FA0"
            onPress={handleChildSpace}
            theme={theme}
          />
          <SettingRow
            icon="add-circle-outline"
            label={t('settings.addChild')}
            value={t('settings.addChildDesc')}
            onPress={() => router.push('/invite/children')}
            theme={theme}
          />
        </View>

        {/* ─ Apparence ─ */}
        <SectionHeader title={t('settings.appearance')} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Mode d'affichage */}
          <View style={styles.themeContainer}>
            <Text style={[styles.themeGroupLabel, { color: theme.textSecondary }]}>{t('settings.displayMode')}</Text>
            <View style={styles.modeRow}>
              {(['auto', 'light', 'dark'] as ThemeMode[]).map((mode) => {
                const labels: Record<ThemeMode, string> = { auto: t('settings.modeAuto'), light: t('settings.modeLight'), dark: t('settings.modeDark') };
                const icons: Record<ThemeMode, string> = { auto: 'phone-portrait-outline', light: 'sunny-outline', dark: 'moon-outline' };
                const isActive = themeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeChip,
                      { borderColor: theme.border },
                      isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setThemeMode(mode)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={icons[mode] as any}
                      size={16}
                      color={isActive ? '#FFF' : theme.textSecondary}
                    />
                    <Text style={[
                      styles.modeChipLabel,
                      { color: isActive ? '#FFF' : theme.textSecondary },
                    ]}>
                      {labels[mode]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.themeContainer}>
            <Text style={[styles.themeGroupLabel, { color: theme.textSecondary }]}>{t('settings.adultThemes')}</Text>
            <View style={styles.themeGrid}>
              {adultThemes.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.themeChip,
                    { backgroundColor: t.primary },
                    themeId === t.id && styles.themeChipActive,
                  ]}
                  onPress={() => handleThemeChange(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                  {themeId === t.id && (
                    <View style={styles.themeCheckMark}>
                      <Ionicons name="checkmark" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.themeGroupLabel, { color: theme.textSecondary, marginTop: 12 }]}>{t('settings.childThemes')}</Text>
            <View style={styles.themeGrid}>
              {childThemes.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.themeChip,
                    { backgroundColor: t.primary },
                    themeId === t.id && styles.themeChipActive,
                  ]}
                  onPress={() => handleThemeChange(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                  {themeId === t.id && (
                    <View style={styles.themeCheckMark}>
                      <Ionicons name="checkmark" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {updatingTheme && (
              <View style={styles.themeLoading}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.themeLoadingText, { color: theme.textSecondary }]}>{t('settings.applying')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─ Notifications ─ */}
        <SectionHeader title={t('home.notifications')} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="notifications-outline"
            label={t('settings.pushNotifications')}
            value={t('settings.pushNotifDesc')}
            theme={theme}
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFF"
              />
            }
          />
        </View>

        {/* ─ Langue ─ */}
        <SectionHeader title={t('settings.language')} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="language-outline"
            label={t('settings.appLanguage')}
            value={{ fr: 'Français', en: 'English', es: 'Español', pt: 'Português' }[user?.language ?? lang] ?? 'Français'}
            onPress={() => setShowLanguageModal(true)}
            theme={theme}
          />
        </View>

        {/* ─ Confidentialité ─ */}
        <SectionHeader title={t('step5.title')} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="document-text-outline"
            label={t('step5.cgu')}
            onPress={handleShowCgu}
            theme={theme}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label={t('settings.privacyPolicy')}
            onPress={handleShowPrivacy}
            theme={theme}
          />
          <SettingRow
            icon="download-outline"
            label={t('settings.exportData')}
            value={t('settings.exportDataDesc')}
            iconColor="#276749"
            onPress={handleExportData}
            theme={theme}
          />
          <SettingRow
            icon="trash-outline"
            label={t('settings.deleteAccount')}
            iconColor={theme.danger}
            onPress={() =>
              Alert.alert(
                t('settings.deleteConfirm'),
                t('settings.deleteConfirmDesc'),
                [
                  { text: t('cancel'), style: 'cancel' },
                  {
                    text: 'Supprimer définitivement',
                    style: 'destructive',
                    onPress: handleDeleteAccount,
                  },
                ]
              )
            }
            theme={theme}
            danger
          />
        </View>

        {/* ─ Déconnexion ─ */}
        <View style={{ marginTop: 8, marginHorizontal: 16 }}>
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: theme.danger }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
            <Text style={[styles.logoutText, { color: theme.danger }]}>{t('settings.logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* ─ Version ─ */}
        <Text style={[styles.version, { color: theme.textSecondary }]}>
          {t('settings.version')}
        </Text>

      </ScrollView>

      {/* ─ Modal changement de PIN ─ */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinModal(false)}
      >
        <View style={pinModalStyles.overlay}>
          <View style={[pinModalStyles.container, { backgroundColor: theme.surface }]}>
            <Text style={[pinModalStyles.title, { color: theme.text }]}>
              {t('settings.changePin')}
            </Text>

            <Text style={[pinModalStyles.label, { color: theme.textSecondary }]}>
              Ancien code PIN
            </Text>
            <TextInput
              style={[pinModalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              value={oldPin}
              onChangeText={setOldPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6 chiffres"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[pinModalStyles.label, { color: theme.textSecondary }]}>
              Nouveau code PIN
            </Text>
            <TextInput
              style={[pinModalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              value={newPin}
              onChangeText={setNewPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6 chiffres"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[pinModalStyles.label, { color: theme.textSecondary }]}>
              Confirmer le nouveau PIN
            </Text>
            <TextInput
              style={[pinModalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              value={confirmPin}
              onChangeText={setConfirmPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6 chiffres"
              placeholderTextColor={theme.textSecondary}
            />

            <View style={pinModalStyles.buttons}>
              <TouchableOpacity
                style={[pinModalStyles.cancelBtn, { borderColor: theme.border }]}
                onPress={() => {
                  setShowPinModal(false);
                  setOldPin('');
                  setNewPin('');
                  setConfirmPin('');
                }}
              >
                <Text style={[pinModalStyles.cancelText, { color: theme.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pinModalStyles.confirmBtn, { backgroundColor: theme.primary }]}
                onPress={handleChangePin}
                disabled={changingPin}
              >
                {changingPin ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={pinModalStyles.confirmText}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─ Modal modification profil (Bug #7) ─ */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={pinModalStyles.overlay}>
          <View style={[pinModalStyles.container, { backgroundColor: theme.surface }]}>
            <Text style={[pinModalStyles.title, { color: theme.text }]}>
              {t('settings.editProfile')}
            </Text>

            <Text style={[pinModalStyles.label, { color: theme.textSecondary }]}>
              {t('step2.firstName')}
            </Text>
            <TextInput
              style={[pinModalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, textAlign: 'left', letterSpacing: 0 }]}
              value={profileFirstName}
              onChangeText={setProfileFirstName}
              placeholder={t('step2.firstNamePH')}
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[pinModalStyles.label, { color: theme.textSecondary }]}>
              {t('step2.lastName')}
            </Text>
            <TextInput
              style={[pinModalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, textAlign: 'left', letterSpacing: 0 }]}
              value={profileLastName}
              onChangeText={setProfileLastName}
              placeholder={t('step2.lastNamePH')}
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[pinModalStyles.label, { color: theme.textSecondary }]}>
              {t('step2.email')}
            </Text>
            <TextInput
              style={[pinModalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, textAlign: 'left', letterSpacing: 0 }]}
              value={profileEmail}
              onChangeText={setProfileEmail}
              placeholder={t('step2.emailPH')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={pinModalStyles.buttons}>
              <TouchableOpacity
                style={[pinModalStyles.cancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowProfileModal(false)}
              >
                <Text style={[pinModalStyles.cancelText, { color: theme.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pinModalStyles.confirmBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={pinModalStyles.confirmText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─ Modal langue (Bug #13) ─ */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={pinModalStyles.overlay}>
          <View style={[pinModalStyles.container, { backgroundColor: theme.surface }]}>
            <Text style={[pinModalStyles.title, { color: theme.text }]}>
              {t('settings.appLanguage')}
            </Text>
            {LANGUAGES.map((l) => {
              const isActive = (user?.language ?? lang) === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[langModalStyles.langRow, { borderBottomColor: theme.border, backgroundColor: isActive ? theme.primary + '15' : 'transparent' }]}
                  onPress={() => handleSelectLanguage(l.code)}
                >
                  <Text style={langModalStyles.langFlag}>{l.flag}</Text>
                  <Text style={[langModalStyles.langLabel, { color: theme.text }]}>{l.label}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[pinModalStyles.cancelBtn, { borderColor: theme.border, marginTop: 16 }]}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={[pinModalStyles.cancelText, { color: theme.textSecondary }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─ Modal CGU (Bug #20) ─ */}
      <Modal
        visible={showCguModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCguModal(false)}
      >
        <View style={pinModalStyles.overlay}>
          <View style={[legalModalStyles.container, { backgroundColor: theme.surface }]}>
            <Text style={[pinModalStyles.title, { color: theme.text }]}>
              {t('step5.cgu')}
            </Text>
            <ScrollView style={legalModalStyles.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
              {loadingCgu ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
              ) : (
                <Text style={[legalModalStyles.content, { color: theme.text }]}>
                  {cguContent}
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[pinModalStyles.confirmBtn, { backgroundColor: theme.primary, marginTop: 12 }]}
              onPress={() => setShowCguModal(false)}
            >
              <Text style={pinModalStyles.confirmText}>{t('ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─ Modal Politique de confidentialité (Bug #21) ─ */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={pinModalStyles.overlay}>
          <View style={[legalModalStyles.container, { backgroundColor: theme.surface }]}>
            <Text style={[pinModalStyles.title, { color: theme.text }]}>
              {t('settings.privacyPolicy')}
            </Text>
            <ScrollView style={legalModalStyles.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
              {loadingPrivacy ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
              ) : (
                <Text style={[legalModalStyles.content, { color: theme.text }]}>
                  {privacyContent}
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[pinModalStyles.confirmBtn, { backgroundColor: theme.primary, marginTop: 12 }]}
              onPress={() => setShowPrivacyModal(false)}
            >
              <Text style={pinModalStyles.confirmText}>{t('ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: 20, paddingBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },

  // Profil
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 16, padding: 16, borderRadius: 16, borderWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:    { fontSize: 22, fontWeight: '800', color: '#FFF' },
  profileName:   { fontSize: 17, fontWeight: '700' },
  parentTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  parentTypeLabel: { fontSize: 13, fontWeight: '600' },
  profileEmail:  { fontSize: 12, marginTop: 2 },
  unverifiedBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  unverifiedText: { fontSize: 11, color: '#92400E', fontWeight: '700' },

  // Section
  section: {
    marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },

  // Mode d'affichage
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8,
  },
  modeChipLabel: { fontSize: 12, fontWeight: '700' },

  // Thèmes
  themeContainer: { padding: 16 },
  themeGroupLabel: { fontSize: 11, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeChip: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  themeChipActive: {
    borderWidth: 3, borderColor: '#FFF',
    ...Platform.select({
      ios:     { shadowOpacity: 0.35 },
      android: { elevation: 6 },
    }),
  },
  themeCheckMark: {
    position: 'absolute', top: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#1D9E75',
    justifyContent: 'center', alignItems: 'center',
  },
  themeLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  themeLoadingText: { fontSize: 12 },

  // Déconnexion
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 14,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },

  version: { fontSize: 11, textAlign: 'center', marginTop: 20, marginBottom: 8 },
});

const pinModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});

const langModalStyles = StyleSheet.create({
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 2,
  },
  langFlag: { fontSize: 22, marginRight: 12 },
  langLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
});

const legalModalStyles = StyleSheet.create({
  container: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 24,
  },
  scroll: {
    maxHeight: 400,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
  },
});

