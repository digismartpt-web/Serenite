import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { useRouter }          from 'expo-router';
import { Ionicons }           from '@expo/vector-icons';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';
import * as SecureStore        from 'expo-secure-store';
import AsyncStorage            from '@react-native-async-storage/async-storage';

import { useTheme, THEMES, Theme, ThemeMode } from '../context/ThemeContext';
import { useAuth }                           from '../hooks/useAuth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────

const PARENT_TYPE_LABELS: Record<string, string> = {
  'papa':       'Papa',
  'maman':      'Maman',
  'beau-pere':  'Beau-père',
  'belle-mere': 'Belle-mère',
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

  const [notifications, setNotifications] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [updatingTheme, setUpdatingTheme] = useState(false);

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
      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();
      const json = JSON.stringify(data, null, 2);

      // Sauvegarder dans AsyncStorage pour téléchargement / partage
      await AsyncStorage.setItem('@serenite/rgpd-export', json);

      Alert.alert(
        'Export réussi',
        'Vos données personnelles ont été exportées avec succès.\n\n' +
        `Contenu : ${json.length.toLocaleString('fr-FR')} caractères au format JSON.`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert(
        'Erreur',
        'Impossible d\'exporter vos données. Vérifiez votre connexion.'
      );
    }
  }

  // ── Déconnexion ────────────────────────────────────────────
  function handleLogout() {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
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

  const adultThemes = Object.values(THEMES).filter((t) => !t.isChildTheme);
  const childThemes = Object.values(THEMES).filter((t) =>  t.isChildTheme);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ─ Header ─ */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Profil & Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ─ Avatar / Profil ─ */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {user ? `${user.firstName} ${user.lastName}` : 'Chargement…'}
            </Text>
            {user?.parentType && (
              <View style={styles.parentTypeBadge}>
                <Text style={{ fontSize: 16 }}>{PARENT_TYPE_EMOJIS[user.parentType] ?? '👤'}</Text>
                <Text style={[styles.parentTypeLabel, { color: theme.primary }]}>
                  {PARENT_TYPE_LABELS[user.parentType] ?? user.parentType}
                </Text>
              </View>
            )}
            <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
              {user?.email ?? ''}
            </Text>
          </View>
          {user && !user.emailVerified && (
            <View style={styles.unverifiedBadge}>
              <Text style={styles.unverifiedText}>Email non vérifié</Text>
            </View>
          )}
        </View>

        {/* ─ Compte ─ */}
        <SectionHeader title="Compte" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="person-outline"
            label="Modifier mon profil"
            value="Nom, prénom, téléphone"
            onPress={() => {}}
            theme={theme}
          />
          <SettingRow
            icon="lock-closed-outline"
            label="Changer mon code PIN"
            onPress={() => {}}
            theme={theme}
          />
          <SettingRow
            icon="mail-outline"
            label={user?.email ?? ''}
            value={user?.emailVerified ? 'Adresse vérifiée ✓' : 'Adresse non vérifiée'}
            iconColor={user?.emailVerified ? '#276749' : '#D97706'}
            theme={theme}
          />
        </View>

        {/* ─ Famille ─ */}
        <SectionHeader title="Famille" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="people-outline"
            label="Gérer ma famille"
            value="Coparent, enfants"
            onPress={() => router.push('/invite/send')}
            theme={theme}
          />
          <SettingRow
            icon="happy-outline"
            label="Espace Enfant"
            value="Interface violet adaptée aux enfants"
            iconColor="#5B3FA0"
            onPress={handleChildSpace}
            theme={theme}
          />
        </View>

        {/* ─ Apparence ─ */}
        <SectionHeader title="Apparence" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Mode d'affichage */}
          <View style={styles.themeContainer}>
            <Text style={[styles.themeGroupLabel, { color: theme.textSecondary }]}>Mode d'affichage</Text>
            <View style={styles.modeRow}>
              {(['auto', 'light', 'dark'] as ThemeMode[]).map((mode) => {
                const labels: Record<ThemeMode, string> = { auto: 'Auto', light: 'Clair', dark: 'Sombre' };
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
            <Text style={[styles.themeGroupLabel, { color: theme.textSecondary }]}>Thèmes adultes</Text>
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

            <Text style={[styles.themeGroupLabel, { color: theme.textSecondary, marginTop: 12 }]}>Thèmes enfants</Text>
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
                <Text style={[styles.themeLoadingText, { color: theme.textSecondary }]}>Application…</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─ Notifications ─ */}
        <SectionHeader title="Notifications" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="notifications-outline"
            label="Notifications push"
            value="Nouveaux messages, événements"
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
        <SectionHeader title="Langue" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="language-outline"
            label="Langue de l'application"
            value={user?.language === 'en' ? 'English' : 'Français'}
            onPress={() => {}}
            theme={theme}
          />
        </View>

        {/* ─ Confidentialité ─ */}
        <SectionHeader title="Confidentialité" theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon="document-text-outline"
            label="Conditions Générales d'Utilisation"
            onPress={() => {}}
            theme={theme}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Politique de confidentialité"
            onPress={() => {}}
            theme={theme}
          />
          <SettingRow
            icon="download-outline"
            label="Exporter mes données RGPD"
            value="JSON — toutes mes données personnelles"
            iconColor="#276749"
            onPress={handleExportData}
            theme={theme}
          />
          <SettingRow
            icon="trash-outline"
            label="Supprimer mon compte"
            iconColor={theme.danger}
            onPress={() =>
              Alert.alert(
                'Supprimer le compte',
                'Cette action est irréversible. Toutes vos données seront effacées.',
                [{ text: 'Annuler', style: 'cancel' }]
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
            <Text style={[styles.logoutText, { color: theme.danger }]}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        {/* ─ Version ─ */}
        <Text style={[styles.version, { color: theme.textSecondary }]}>
          Sérénité v1.0.0 — by Premium à juste prix
        </Text>

      </ScrollView>
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
