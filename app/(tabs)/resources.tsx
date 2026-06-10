import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../hooks/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────

interface EmergencyContact {
  name:        string;
  phone:       string;
  description: string;
}

interface Mediator {
  name:    string;
  phone?:  string;
  website: string;
}

interface WebResource {
  name:    string;
  website: string;
}

interface ResourcesData {
  emergency: EmergencyContact[];
  mediators: Mediator[];
  resources: WebResource[];
}

interface ResourcesApiResponse {
  [lang: string]: ResourcesData;
}

type LanguageCode = 'fr' | 'en' | 'es' | 'pt';

const SUPPORTED_LANGS: LanguageCode[] = ['fr', 'en', 'es', 'pt'];
const DEFAULT_LANG: LanguageCode = 'fr';

// ─── Sections ─────────────────────────────────────────────────

function EmergencySection({
  contacts, theme, insets, t,
}: {
  contacts: EmergencyContact[];
  theme: ReturnType<typeof useTheme>['theme'];
  insets: { bottom: number };
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (contacts.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBg}>
          <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('resources.emergency')}
        </Text>
      </View>
      <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
        {t('resources.emergencyHint')}
      </Text>

      {contacts.map((contact, index) => (
        <TouchableOpacity
          key={`emergency-${index}`}
          style={[styles.emergencyCard, { borderLeftColor: '#E53E3E' }]}
          onPress={() => Linking.openURL(`tel:${contact.phone}`)}
          activeOpacity={0.8}
          accessibilityLabel={t('resources.emergencyCall', { name: contact.name, phone: contact.phone })}
        >
          <View style={[styles.emergencyIcon, { backgroundColor: '#FED7D7' }]}>
            <Ionicons name="call" size={18} color="#C53030" />
          </View>
          <View style={styles.emergencyInfo}>
            <Text style={[styles.emergencyName, { color: '#C53030' }]}>
              {contact.name}
            </Text>
            <Text style={[styles.emergencyDesc, { color: theme.textSecondary }]}>
              {contact.description}
            </Text>
            <Text style={[styles.emergencyPhone, { color: '#E53E3E' }]}>
              📞 {contact.phone}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#E53E3E" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MediatorsSection({
  mediators, theme, t,
}: {
  mediators: Mediator[];
  theme: ReturnType<typeof useTheme>['theme'];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (mediators.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconBg, { backgroundColor: theme.primary }]}>
          <Ionicons name="people" size={18} color="#FFFFFF" />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('resources.mediators')}
        </Text>
      </View>

      {mediators.map((mediator, index) => (
        <View
          key={`mediator-${index}`}
          style={[styles.mediatorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.mediatorBody}>
            <Text style={[styles.mediatorName, { color: theme.text }]}>
              {mediator.name}
            </Text>
            {mediator.phone && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${mediator.phone}`)}
              >
                <Text style={[styles.mediatorPhone, { color: theme.primary }]}>
                  📞 {mediator.phone}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.websiteBtn, { borderColor: theme.primary }]}
            onPress={() => Linking.openURL(mediator.website)}
            accessibilityLabel={t('resources.websiteAria', { name: mediator.name })}
          >
            <Ionicons name="globe-outline" size={16} color={theme.primary} />
            <Text style={[styles.websiteBtnText, { color: theme.primary }]}>
              {t('resources.website')}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function ResourcesSection({
  resources, theme, t,
}: {
  resources: WebResource[];
  theme: ReturnType<typeof useTheme>['theme'];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (resources.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconBg, { backgroundColor: '#718096' }]}>
          <Ionicons name="globe" size={18} color="#FFFFFF" />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('resources.onlineResources')}
        </Text>
      </View>

      {resources.map((resource, index) => (
        <TouchableOpacity
          key={`resource-${index}`}
          style={[styles.resourceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => Linking.openURL(resource.website)}
          activeOpacity={0.8}
          accessibilityLabel={t('resources.openResource', { name: resource.name })}
        >
          <View style={[styles.resourceIcon, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="link" size={16} color={theme.textSecondary} />
          </View>
          <Text style={[styles.resourceName, { color: theme.text }]}>
            {resource.name}
          </Text>
          <Ionicons name="open-outline" size={14} color={theme.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────

export default function ResourcesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResourcesData | null>(null);

  // Déterminer la langue : user.language prévaut, sinon détection appareil
  const lang = detectLanguage(user?.language);

  useEffect(() => {
    fetch(`${API_BASE}/api/mediators`)
      .then((r) => r.json())
      .then((json: ResourcesApiResponse) => {
        // Essayer la langue détectée, sinon 'fr', sinon la première disponible
        const resources = json[lang] ?? json[DEFAULT_LANG] ?? json[Object.keys(json)[0]];
        setData(resources as ResourcesData);
      })
      .catch(() => {
        // Fallback silencieux — données vides
        setData({ emergency: [], mediators: [], resources: [] });
      })
      .finally(() => setLoading(false));
  }, [lang]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── En-tête ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t('resources.headerTitle')}
          </Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            {t('resources.headerSub')}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('settings.loading')}
          </Text>
        </View>
      ) : (
        <>
          <EmergencySection contacts={data?.emergency ?? []} theme={theme} insets={insets} t={t} />
          <MediatorsSection mediators={data?.mediators ?? []} theme={theme} t={t} />
          <ResourcesSection resources={data?.resources ?? []} theme={theme} t={t} />
        </>
      )}
    </ScrollView>
  );
}

// ─── Détection de langue ─────────────────────────────────────

function detectLanguage(userLang?: string): LanguageCode {
  // 1. Langue du profil utilisateur
  if (userLang && SUPPORTED_LANGS.includes(userLang as LanguageCode)) {
    return userLang as LanguageCode;
  }

  // 2. Détection depuis l'appareil
  try {
    const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale?.slice(0, 2);
    if (deviceLocale && SUPPORTED_LANGS.includes(deviceLocale as LanguageCode)) {
      return deviceLocale as LanguageCode;
    }
  } catch {
    // Ignorer — fallback au français
  }

  return DEFAULT_LANG;
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1 },
  container: { paddingHorizontal: 20, gap: 20 },

  // ── En-tête
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerSub:   { fontSize: 14, fontWeight: '500', marginTop: 2 },

  // ── Loading
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '600' },

  // ── Section générique
  section:      { gap: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionHint:  { fontSize: 12, fontWeight: '500', marginTop: -6 },

  // ── Urgences (rouge)
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    ...Platform.select({
      ios:     { shadowColor: '#E53E3E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  emergencyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyInfo: { flex: 1, gap: 2 },
  emergencyName: { fontSize: 14, fontWeight: '700' },
  emergencyDesc: { fontSize: 12 },
  emergencyPhone: { fontSize: 13, fontWeight: '700', marginTop: 2 },

  // ── Médiateurs (bleu)
  mediatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  mediatorBody:   { flex: 1, gap: 4 },
  mediatorName:   { fontSize: 14, fontWeight: '700' },
  mediatorPhone:  { fontSize: 13, fontWeight: '600' },
  websiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  websiteBtnText: { fontSize: 12, fontWeight: '700' },

  // ── Ressources web (gris)
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  resourceIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
