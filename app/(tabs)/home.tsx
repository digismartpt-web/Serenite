import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons }  from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n/useTranslation';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../hooks/useAuth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────

interface Notification {
  id:      string;
  icon:    string;
  title:   string;
  body:    string;
  time:    string;
  unread:  boolean;
}

interface Shortcut {
  id:     string;
  icon:   React.ComponentProps<typeof Ionicons>['name'];
  label:  string;
  route:  string;
  color:  string;
}

interface MedicalEvent {
  id:         string;
  title:      string;
  start_at:   string;
  end_at:     string;
  all_day:    boolean;
  category:   string;
  event_type: string | null;
  color:      string | null;
  creator_first_name: string;
}

// ─── Données mock (remplacées par API en Wave 2-3) ───────────

const SHORTCUTS: Shortcut[] = [
  { id: 'agenda',    icon: 'calendar-outline',  label: 'home.agenda',    route: '/(tabs)/calendar', color: '#4A90D9' },
  { id: 'message',   icon: 'chatbubble-outline', label: 'home.message',   route: '/(tabs)/messages', color: '#1D9E75' },
  { id: 'depense',   icon: 'receipt-outline',    label: 'home.expense',   route: '/(tabs)/finances', color: '#D97706' },
];

// ─── Utilitaires ──────────────────────────────────────────────

function computeCountdown(): string {
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'home.greeting.morning';
  if (h < 18) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}

// ─── Écran Accueil ────────────────────────────────────────────

export default function HomeScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user, token }  = useAuth();
  const { t } = useTranslation();

  const [countdown, setCountdown] = useState(computeCountdown());
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [medicalEvents, setMedicalEvents] = useState<MedicalEvent[]>([]);
  const [loadingMedical, setLoadingMedical] = useState(false);

  // ── Charger famille ──────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/families/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setFamilyId(d.family?.id ?? null))
      .catch(() => {});
  }, [token]);

  // ── Charger les prochains RDV médicaux ─────────────────────
  useEffect(() => {
    if (!token || !familyId) return;
    setLoadingMedical(true);
    const now   = new Date();
    const threeMonths = new Date(now);
    threeMonths.setMonth(threeMonths.getMonth() + 3);
    fetch(
      `${API_BASE}/api/events?familyId=${familyId}&from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(threeMonths.toISOString())}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((d) => {
        const events: MedicalEvent[] = d.events ?? [];
        // Filtrer : catégorie 'medical' OU event_type 'medical'
        setMedicalEvents(
          events.filter((e: MedicalEvent) =>
            e.category === 'medical' || e.event_type === 'medical'
          )
        );
      })
      .catch(() => {})
      .finally(() => setLoadingMedical(false));
  }, [token, familyId]);

  // Barre sérénité — sera alimenté par l'API
  const serenityAnim = useRef(new Animated.Value(0)).current;
  const SERENITY_SCORE = null; // null = pas encore calculé

  useEffect(() => {
    if (SERENITY_SCORE !== null) {
      Animated.spring(serenityAnim, {
        toValue:   SERENITY_SCORE,
        damping:   14,
        stiffness: 80,
        useNativeDriver: false,
      }).start();
    }
  }, []);

  // Compte à rebours live
  useEffect(() => {
    const interval = setInterval(() => setCountdown(computeCountdown()), 1000);
    return () => clearInterval(interval);
  }, []);

  const serenityWidth = serenityAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  const firstName  = user?.firstName ?? 'vous';
  // Alimenté par l'API agenda quand connecté à une famille
  const [custodyAt, setCustodyAt] = useState<string | null>(null);
  const [custodyEmoji, setCustodyEmoji] = useState<string | null>(null);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* ─── En-tête ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            {t(greetingByHour())},
          </Text>
          <Text style={[styles.firstName, { color: theme.text }]}>
            {firstName} 👋
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/messages')}
          accessibilityLabel={t('home.notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.primary} />
          {false && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      {/* ─── Bannière garde — affichée seulement si donnée disponible ── */}
      {custodyAt && custodyEmoji && (
      <View style={[styles.custodyCard, { backgroundColor: theme.primary }]}>
        <View style={styles.custodyLeft}>
          <Text style={styles.custodyLabel}>{t('home.tonight')}</Text>
          <Text style={styles.custodyTitle}>
            {custodyEmoji}  Chez {custodyAt}
          </Text>
          <Text style={styles.custodyCountdown}>⏱  {countdown}</Text>
        </View>
        <View style={styles.custodyRight}>
          <TouchableOpacity
            style={styles.custodyBtn}
            onPress={() => router.push('/(tabs)/calendar')}
            accessibilityLabel={t('home.viewAgenda')}
          >
            <Text style={styles.custodyBtnText}>{t('home.agenda')} →</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {/* ─── Raccourcis ────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('home.quickAccess')}</Text>
      </View>
      <View style={styles.shortcuts}>
        {SHORTCUTS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.shortcutBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push(s.route as any)}
            activeOpacity={0.8}
            accessibilityLabel={t(s.label)}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: s.color + '18' }]}>
              <Ionicons name={s.icon} size={22} color={s.color} />
            </View>
            <Text style={[styles.shortcutLabel, { color: theme.text }]}>{t(s.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── Métriques ─────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('home.today')}</Text>
      </View>
      <View style={styles.metrics}>

        {/* Messages non lus */}
        <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.metricRow}>
            <View style={[styles.metricIconBg, { backgroundColor: '#4A90D918' }]}>
              <Ionicons name="chatbubbles" size={20} color="#4A90D9" />
            </View>
            <Text style={[styles.metricValue, { color: theme.text }]}>0</Text>
          </View>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            {t('home.unreadMessages')}
          </Text>
        </View>

        {/* Score sérénité */}
        <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.metricRow}>
            <View style={[styles.metricIconBg, { backgroundColor: '#1D9E7518' }]}>
              <Ionicons name="leaf" size={20} color="#1D9E75" />
            </View>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {SERENITY_SCORE !== null ? `${Math.round(SERENITY_SCORE * 100)}%` : '--'}
            </Text>
          </View>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            {t('home.serenityScore')}
          </Text>
        </View>

      </View>

      {/* ─── Barre sérénité — visible seulement si score disponible ── */}
      {SERENITY_SCORE !== null && (
      <View style={[styles.serenityCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.serenityHeader}>
          <Text style={[styles.serenityTitle, { color: theme.text }]}>
            🕊️  {t('home.serenityIndex')}
          </Text>
          <Text style={[styles.serenityScore, { color: '#1D9E75' }]}>
            {Math.round(SERENITY_SCORE * 100)} / 100
          </Text>
        </View>
        <View style={[styles.serenityTrack, { backgroundColor: theme.surfaceAlt }]}>
          <Animated.View
            style={[styles.serenityFill, { width: serenityWidth }]}
            accessibilityLabel={t('home.serenityAria', { score: Math.round(SERENITY_SCORE * 100) })}
          />
        </View>
        <Text style={[styles.serenityHint, { color: theme.textSecondary }]}>
          {t('home.basedOnMessages')}
        </Text>
      </View>
      )}

      {/* ─── Prochains RDV médicaux ────────────────────────── */}
      {medicalEvents.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🏥  {t('home.medicalAppts')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/calendar')}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>{t('home.agenda')} →</Text>
            </TouchableOpacity>
          </View>
          {medicalEvents.slice(0, 3).map((ev) => {
            const d = new Date(ev.start_at);
            const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const timeStr = ev.all_day
              ? t('home.allDay')
              : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return (
              <TouchableOpacity
                key={ev.id}
                style={[styles.medicalCard, { backgroundColor: theme.surface, borderColor: '#FC8181' }]}
                onPress={() => router.push('/(tabs)/calendar')}
                activeOpacity={0.8}
              >
                <View style={styles.medicalIconBg}>
                  <Text style={{ fontSize: 22 }}>🏥</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medicalTitle, { color: theme.text }]}>{ev.title}</Text>
                  <Text style={[styles.medicalMeta, { color: theme.textSecondary }]}>
                    {dateStr} · {timeStr}
                  </Text>
                  <Text style={[styles.medicalMeta, { color: theme.textSecondary }]}>
                    👤 {ev.creator_first_name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </>
      )}
      {!loadingMedical && medicalEvents.length === 0 && familyId && (
        <TouchableOpacity
          style={[styles.medicalEmpty, { borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/calendar')}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>🏥</Text>
          <Text style={[styles.medicalEmptyText, { color: theme.textSecondary }]}>
            {t('home.noAppointments')}
          </Text>
          <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
          <Text style={[styles.medicalEmptyAction, { color: theme.primary }]}>{t('home.add')}</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1 },
  container: { paddingHorizontal: 20, gap: 14 },

  // ── En-tête
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   4,
  },
  greeting: { fontSize: 14, fontWeight: '500' },
  firstName: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  notifBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#E53E3E',
  },

  // ── Bannière garde
  custodyCard: {
    borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  custodyLeft:      { flex: 1, gap: 4 },
  custodyLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.70)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  custodyTitle:     { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  custodyCountdown: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },
  custodyRight:     { justifyContent: 'center' },
  custodyBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
  },
  custodyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // ── Section
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  seeAll:       { fontSize: 13, fontWeight: '600' },

  // ── Raccourcis
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcutBtn: {
    flex: 1, alignItems: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  shortcutIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  shortcutLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // ── Métriques
  metrics:    { flexDirection: 'row', gap: 12 },
  metricCard: {
    flex: 1, borderRadius: 14, padding: 16, borderWidth: 1, gap: 10,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  metricRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricIconBg: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  metricValue:  { fontSize: 22, fontWeight: '800' },
  metricLabel:  { fontSize: 12, lineHeight: 16 },

  // ── Barre sérénité
  serenityCard: {
    borderRadius: 14, padding: 16, borderWidth: 1, gap: 10,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  serenityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serenityTitle:  { fontSize: 14, fontWeight: '700' },
  serenityScore:  { fontSize: 16, fontWeight: '800' },
  serenityTrack:  { height: 10, borderRadius: 5, overflow: 'hidden' },
  serenityFill: {
    height: '100%', borderRadius: 5,
    backgroundColor: '#1D9E75',
  },
  serenityHint:   { fontSize: 12 },

  // ── Notifications
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  notifCardIcon:   { fontSize: 24 },
  notifCardTexts:  { flex: 1, gap: 2 },
  notifCardRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifCardTitle:  { fontSize: 14, fontWeight: '700', flex: 1 },
  notifCardTime:   { fontSize: 11, marginLeft: 8 },
  notifCardBody:   { fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },

  // ── RDV médicaux
  medicalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, borderLeftWidth: 4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  medicalIconBg: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#FC818122',
    justifyContent: 'center', alignItems: 'center',
  },
  medicalTitle: { fontSize: 14, fontWeight: '700' },
  medicalMeta:  { fontSize: 12, marginTop: 1 },
  medicalEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  medicalEmptyText:   { fontSize: 13, flex: 1 },
  medicalEmptyAction: { fontSize: 13, fontWeight: '700' },
});
