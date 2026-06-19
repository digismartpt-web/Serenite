import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Platform, Alert, Linking, Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../../i18n/useTranslation';

const SecureStore = Platform.OS === 'web'
  ? { getItemAsync: async (k: string): Promise<string | null> => { try { return localStorage.getItem(k) } catch { return null } } }
  : require('expo-secure-store');

import { API_BASE } from '../constants/api';

// ─── Constantes ───────────────────────────────────────────────

const CHILD_PURPLE  = '#5B3FA0';
const CHILD_DARK    = '#3D2870';
const CHILD_LIGHT   = '#FAF5FF';
const CHILD_BORDER  = '#E9D8FD';
const CHILD_ACCENT  = '#F6AD55';
const CHILD_GREEN   = '#48BB78';

const DAYS_SHORT    = ['day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat', 'day.sun'];
const MOODS         = ['😞', '😕', '😐', '🙂', '😄'];
const MOOD_LABEL_KEYS = ['child.mood.sad', 'child.mood.notGood', 'child.mood.normal', 'child.mood.good', 'child.mood.super'];
const MOOD_COLORS   = ['#FC8181', '#F6AD55', '#90CDF4', '#68D391', '#F6E05E'];

const JOURNAL_KEY   = '@serenite/child_journal';
const MOOD_KEY      = '@serenite/child_mood';
const CHECKLIST_KEY = '@serenite/child_checklist';
const TOKEN_KEY='serenite_auth_token';

// ─── Items checklist sac ──────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: 'school',    labelKey: 'child.checklist.school', emoji: '📚' },
  { id: 'sport',     labelKey: 'child.checklist.sport',     emoji: '👟' },
  { id: 'pyjama',   labelKey: 'child.checklist.pyjama',   emoji: '🌙' },
  { id: 'doudou',   labelKey: 'child.checklist.doudou',    emoji: '🧸' },
  { id: 'charger',  labelKey: 'child.checklist.charger',  emoji: '🔌' },
  { id: 'medicine', labelKey: 'child.checklist.medicine',  emoji: '💊' },
  { id: 'money',    labelKey: 'child.checklist.money',      emoji: '💰' },
];

// ─── Utilitaires ──────────────────────────────────────────────

function getWeekDays(weekOffset: number = 0): { date: Date; label: string; dayNum: number; isToday: boolean }[] {
  const today = new Date();
  const day   = today.getDay(); // 0=dimanche
  // Début de semaine = lundi
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return DAYS_SHORT.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + (weekOffset * 7) + i);
    return {
      date:    d,
      label,
      dayNum:  d.getDate(),
      isToday: weekOffset === 0 && d.toDateString() === today.toDateString(),
    };
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Écran principal ──────────────────────────────────────────

export default function ChildHome() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();

  // Âge simulateur (remplacé par l'API plus tard)
  const [childAge, setChildAge]       = useState<'4-7' | '8-12' | '13-17'>('8-12');
  // Humeur
  const [mood, setMood]               = useState<number | null>(null);
  // Journal
  const [journalText, setJournalText] = useState('');
  const [journalSaved, setJournalSaved] = useState(false);
  // Checklist
  const [checked, setChecked]         = useState<Record<string, boolean>>({});
  // Week navigation (Bug #17)
  const [weekOffset, setWeekOffset]   = useState(0);
  // Family data for parent calls (Bug #19)
  const [familyData, setFamilyData]   = useState<any>(null);

  // ── Adaptation par âge ──────────────────────────────────────────
  function getAgeAdaptation(age: '4-7' | '8-12' | '13-17') {
    switch (age) {
      case '4-7':
        return {
          fontSize: { title: 24, body: 20, button: 18 },
          spacing: 24,
          iconSize: 48,
          showLabels: false,
          simpleText: true,
          detailedView: false,
        };
      case '8-12':
        return {
          fontSize: { title: 22, body: 16, button: 16 },
          spacing: 16,
          iconSize: 36,
          showLabels: true,
          simpleText: true,
          detailedView: false,
        };
      case '13-17':
        return {
          fontSize: { title: 20, body: 14, button: 14 },
          spacing: 12,
          iconSize: 28,
          showLabels: true,
          simpleText: false,
          detailedView: true,
        };
    }
  }

  const weekDays = getWeekDays(weekOffset);

  // ── Chargement initial ───────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [m, j, c] = await Promise.all([
        AsyncStorage.getItem(MOOD_KEY + '_' + new Date().toDateString()),
        AsyncStorage.getItem(JOURNAL_KEY + '_' + new Date().toDateString()),
        AsyncStorage.getItem(CHECKLIST_KEY),
      ]);
      if (m !== null) setMood(parseInt(m, 10));
      if (j)          setJournalText(j);
      if (c)          setChecked(JSON.parse(c));

      // Fetch family data for parent calls (Bug #19)
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          const res = await fetch(`${API_BASE}/api/families/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setFamilyData(data);
          }
        }
      } catch (e) {
        console.log('Could not fetch family data:', e);
      }
    }
    load();
  }, []);

  // ── Sauvegarder humeur ───────────────────────────────────────
  async function handleMood(idx: number) {
    setMood(idx);
    Vibration.vibrate(50);
    await AsyncStorage.setItem(MOOD_KEY + '_' + new Date().toDateString(), String(idx));
  }

  // ── Sauvegarder journal ──────────────────────────────────────
  async function saveJournal() {
    await AsyncStorage.setItem(JOURNAL_KEY + '_' + new Date().toDateString(), journalText);
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 2000);
  }

  // ── Toggle checklist ─────────────────────────────────────────
  async function toggleCheck(id: string) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    await AsyncStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
  }

  // ── Appel parent (Bug #19 - now uses real phone numbers) ─────
  function callParent(who: 'papa' | 'maman') {
    const parentLabel = who === 'papa' ? t('child.home.dad') : t('child.home.mom');

    let phoneNumber: string | null = null;
    if (familyData) {
      const parent = who === 'papa' ? familyData.parent_a : familyData.parent_b;
      if (parent && parent.phone) {
        phoneNumber = parent.phone;
      }
    }

    if (!phoneNumber) {
      Alert.alert(
        t('child.home.callTitle', { parent: parentLabel }),
        t('child.home.callNoNumber') || `${parentLabel} n'a pas encore ajouté son numéro de téléphone.`
      );
      return;
    }

    Alert.alert(
      t('child.home.callTitle', { parent: parentLabel }),
      t('child.home.callBody', { parent: parentLabel }),
      [
        { text: t('child.home.callNo'), style: 'cancel' },
        {
          text: t('child.home.callYes'),
          onPress: () => {
            Linking.openURL(`tel:${phoneNumber}`);
          },
        },
      ]
    );
  }

  const adapt   = getAgeAdaptation(childAge);
  const today   = new Date();
  const todayStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Week range label for navigation header (Bug #17)
  function getWeekRangeLabel(): string {
    const days = weekDays;
    const first = days[0].date;
    const last = days[6].date;
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()} - ${last.getDate()} ${first.toLocaleDateString('fr-FR', { month: 'long' })}`;
    }
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${first.toLocaleDateString('fr-FR', opts)} - ${last.toLocaleDateString('fr-FR', opts)}`;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: CHILD_LIGHT }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Bonjour ── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>🌟</Text>
        <Text style={[styles.heroTitle, { fontSize: adapt.fontSize.title }]}>{t('child.home.hello')}</Text>
        <Text style={styles.heroDate}>{todayStr}</Text>
      </View>

      {/* ── Sélecteur âge (simulateur) ── */}
      <View style={styles.ageSelector}>
        {(['4-7', '8-12', '13-17'] as const).map((age) => (
          <TouchableOpacity
            key={age}
            style={[styles.ageBtn, childAge === age && styles.ageBtnActive]}
            onPress={() => setChildAge(age)}
            activeOpacity={0.7}
          >
            <Text style={[styles.ageBtnText, childAge === age && styles.ageBtnTextActive]}>
              {age === '4-7' ? '🧸 4-7 ans' : age === '8-12' ? '📚 8-12 ans' : '👤 13-17 ans'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Appels parents ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('child.home.call')}</Text>
        <View style={styles.callRow}>
          <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#2B6CB0' }]} onPress={() => callParent('papa')}>
            <Text style={styles.callEmoji}>👨</Text>
            <Text style={styles.callLabel}>{t('child.home.dad')}</Text>
            <Ionicons name="call" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#702459' }]} onPress={() => callParent('maman')}>
            <Text style={styles.callEmoji}>👩</Text>
            <Text style={styles.callLabel}>{t('child.home.mom')}</Text>
            <Ionicons name="call" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Calendrier semaine (Bug #17 - week navigation) ── */}
      <View style={[styles.section, { marginTop: adapt.spacing }]}>
        <View style={styles.weekHeaderRow}>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)} style={styles.weekNavBtn}>
            <Ionicons name="chevron-back" size={22} color={CHILD_PURPLE} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.sectionTitle, { fontSize: adapt.detailedView ? 14 : 16, marginBottom: 0 }]}>{t('child.home.myWeek')}</Text>
            <Text style={styles.weekRangeLabel}>{getWeekRangeLabel()}</Text>
          </View>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={styles.weekNavBtn}>
            <Ionicons name="chevron-forward" size={22} color={CHILD_PURPLE} />
          </TouchableOpacity>
        </View>
        <View style={[styles.card, styles.weekRow, { padding: adapt.detailedView ? 8 : adapt.spacing / 2 }]}>
          {weekDays.map((d, i) => (
            <View key={i} style={[
              styles.dayCell,
              d.isToday && styles.dayCellToday,
              { padding: adapt.simpleText ? 6 : 4, gap: adapt.simpleText ? 6 : 2 },
            ]}>
              <Text style={[
                styles.dayLabel,
                d.isToday && styles.dayLabelToday,
                { fontSize: adapt.simpleText ? 12 : 10 },
              ]}>{t(d.label)}</Text>
              <Text style={[
                styles.dayNum,
                d.isToday && styles.dayNumToday,
                { fontSize: adapt.simpleText ? 20 : 16, fontWeight: adapt.simpleText ? '900' : '800' },
              ]}>{d.dayNum}</Text>
              {/* Indicateur parent : plus gros pour 4-7 */}
              <View style={[
                styles.dayDot,
                {
                  backgroundColor: i % 2 === 0 ? '#2B6CB0' : '#702459',
                  width: adapt.iconSize > 40 ? 14 : 8,
                  height: adapt.iconSize > 40 ? 14 : 8,
                  borderRadius: adapt.iconSize > 40 ? 7 : 4,
                },
              ]} />
              {/* Détails supplémentaires pour 13-17 */}
              {adapt.detailedView && (
                <Text style={{ fontSize: 9, color: '#6B46C1', marginTop: 2 }}>
                  {i % 2 === 0 ? 'Papa' : 'Maman'}
                </Text>
              )}
            </View>
          ))}
        </View>
        {adapt.showLabels && (
          <Text style={[styles.weekLegend, { fontSize: adapt.simpleText ? 13 : 11 }]}>
            <View style={[styles.legendDot, { backgroundColor: '#2B6CB0' }]} /> {t('child.home.legendDad')} &nbsp;&nbsp;
            <View style={[styles.legendDot, { backgroundColor: '#702459' }]} /> {t('child.home.legendMom')}
          </Text>
        )}
      </View>

      {/* ── Humeur ── */}
      <View style={[styles.section, { marginTop: adapt.spacing }]}>
        <Text style={[styles.sectionTitle, { fontSize: adapt.detailedView ? 14 : 16 }]}>{t('child.home.howFeel')}</Text>
        <View style={[styles.card, styles.moodRow, { padding: adapt.spacing / 2 }]}>
          {MOODS.map((emoji, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.moodBtn,
                mood === i && { backgroundColor: MOOD_COLORS[i] + '33', borderColor: MOOD_COLORS[i], borderWidth: 2 },
                { minWidth: adapt.showLabels ? 48 : 56 },
              ]}
              onPress={() => handleMood(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.moodEmoji, { fontSize: adapt.simpleText ? 40 : (adapt.detailedView ? 28 : 32) }]}>{emoji}</Text>
              {/* Labels : cachés pour 4-7, simples pour 8-12, normaux pour 13-17 */}
              {adapt.showLabels && (
                <Text style={[
                  styles.moodLabel,
                  {
                    color: MOOD_COLORS[i],
                    fontSize: adapt.simpleText ? 10 : 9,
                    fontWeight: adapt.detailedView ? '500' : '700',
                  },
                ]}>
                  {adapt.simpleText
                    ? ['😞','😕','😐','🙂','😄'][i]
                    : t(MOOD_LABEL_KEYS[i])
                  }
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        {mood !== null && (
          <Text style={[styles.moodConfirm, { fontSize: adapt.simpleText ? 14 : 12 }]}>{t('child.home.moodSaved')}</Text>
        )}
      </View>

      {/* ── Checklist sac ── */}
      <View style={[styles.section, { marginTop: adapt.spacing }]}>
        <Text style={[styles.sectionTitle, { fontSize: adapt.detailedView ? 14 : 16 }]}>{t('child.home.bagReady')}</Text>
        <View style={[styles.card, { padding: adapt.spacing }]}>
          {CHECKLIST_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.checkRow, {
                paddingVertical: adapt.simpleText ? 14 : 9,
                gap: adapt.simpleText ? 16 : 10,
              }]}
              onPress={() => toggleCheck(item.id)}
              activeOpacity={0.7}
            >
              {/* Pour 4-7 : pas de checkbox, juste l'emoji géant */}
              {!adapt.simpleText && (
                <View style={[styles.checkbox, checked[item.id] && styles.checkboxChecked]}>
                  {checked[item.id] && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
              )}
              <Text style={[
                styles.checkEmoji,
                {
                  fontSize: adapt.simpleText ? 36 : (adapt.detailedView ? 18 : 22),
                },
                adapt.simpleText && {
                  backgroundColor: checked[item.id] ? CHILD_GREEN + '22' : CHILD_BORDER,
                  borderRadius: 12,
                  padding: 8,
                  overflow: 'hidden',
                },
              ]}>{item.emoji}</Text>
              {/* Texte : aucun pour 4-7, simple pour 8-12, complet pour 13-17 */}
              {adapt.showLabels && (
                <Text style={[
                  styles.checkLabel,
                  checked[item.id] && styles.checkLabelDone,
                  { fontSize: adapt.simpleText ? 16 : 14 },
                ]}>
                  {adapt.detailedView ? t(item.labelKey) : item.emoji + ' ' + t(item.labelKey)}
                </Text>
              )}
              {/* Checkmark visuel pour 4-7 */}
              {adapt.simpleText && checked[item.id] && (
                <View style={{ position: 'absolute', right: 0, top: 10 }}>
                  <Ionicons name="checkmark-circle" size={24} color={CHILD_GREEN} />
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Barre de progression : géante pour 4-7 */}
          <View style={[styles.progressBar, adapt.simpleText && { height: 14, borderRadius: 7 }]}>
            <View
              style={[
                styles.progressFill,
                adapt.simpleText && { borderRadius: 7 },
                {
                  width: `${(Object.values(checked).filter(Boolean).length / CHECKLIST_ITEMS.length) * 100}%` as any,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, {
            fontSize: adapt.simpleText ? 16 : 12,
            fontWeight: adapt.simpleText ? '800' : '600',
          }]}>
            {t('child.home.progressItems', {
              done: Object.values(checked).filter(Boolean).length,
              total: CHECKLIST_ITEMS.length,
            })}
          </Text>
        </View>
      </View>

      {/* ── Journal privé ── */}
      {adapt.simpleText && !adapt.showLabels ? (
        /* 4-7 ans : dictée vocale (placeholder) à la place du journal */
        <View style={[styles.section, { marginTop: adapt.spacing }]}>
          <Text style={[styles.sectionTitle, { fontSize: 16 }]}>{t('child.home.journalTitle')}</Text>
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
            <TouchableOpacity
              style={{
                backgroundColor: CHILD_PURPLE,
                borderRadius: 20,
                paddingVertical: 20,
                paddingHorizontal: 32,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
              activeOpacity={0.7}
              onPress={() => Alert.alert('🎤 Dictée vocale', 'Fonctionnalité à venir (intégration microphone)')}
            >
              <Text style={{ fontSize: 40 }}>🎤</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFF' }}>
                Dire quelque chose
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 13, color: '#9F7AEA', marginTop: 12, fontStyle: 'italic' }}>
              Appuie pour enregistrer ta pensée
            </Text>
          </View>
        </View>
      ) : (
        /* 8-12 ans / 13-17 ans : interface journal */
        <View style={[styles.section, { marginTop: adapt.spacing }]}>
          <Text style={[styles.sectionTitle, { fontSize: adapt.detailedView ? 14 : 16 }]}>{t('child.home.journalTitle')}</Text>
          <View style={[styles.card, { padding: adapt.spacing }]}>
            {adapt.showLabels && (
              <Text style={[styles.journalHint, { fontSize: adapt.simpleText ? 14 : 12 }]}>{t('child.home.journalHint')}</Text>
            )}
            <TextInput
              style={[
                styles.journalInput,
                {
                  minHeight: adapt.simpleText ? 160 : 130,
                  fontSize: adapt.simpleText ? 18 : 14,
                  padding: adapt.simpleText ? 16 : 12,
                  lineHeight: adapt.simpleText ? 28 : 22,
                },
              ]}
              multiline
              numberOfLines={adapt.simpleText ? 5 : 6}
              placeholder={t('child.home.journalPlaceholder')}
              placeholderTextColor="#C4B5FD"
              value={journalText}
              onChangeText={setJournalText}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveBtn, {
                paddingVertical: adapt.simpleText ? 16 : 12,
                borderRadius: adapt.simpleText ? 14 : 10,
              }, journalSaved && styles.saveBtnDone]}
              onPress={saveJournal}
            >
              <Ionicons name={journalSaved ? 'checkmark-circle' : 'save-outline'} size={adapt.simpleText ? 22 : 18} color="#FFF" />
              <Text style={[styles.saveBtnText, { fontSize: adapt.simpleText ? 18 : 14 }]}>
                {journalSaved ? t('child.home.saved') : t('child.home.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: CHILD_PURPLE,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 44 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', marginTop: 6 },
  heroDate:  { fontSize: 14, color: '#C4B5FD', marginTop: 4 },

  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: CHILD_DARK,
    marginBottom: 10, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16, borderWidth: 1, borderColor: CHILD_BORDER,
    padding: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },

  // Appels
  callRow: { flexDirection: 'row', gap: 12 },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 18,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  callEmoji: { fontSize: 24 },
  callLabel: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  // Semaine
  weekHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  weekNavBtn: {
    padding: 8,
  },
  weekRangeLabel: {
    fontSize: 12,
    color: '#6B46C1',
    marginTop: 2,
  },
  weekRow:    { flexDirection: 'row' as const, justifyContent: 'space-between' as const, padding: 8 },
  dayCell:    { alignItems: 'center' as const, gap: 4, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 10 },
  dayCellToday: { backgroundColor: CHILD_PURPLE },
  dayLabel:   { fontSize: 10, color: '#6B46C1', fontWeight: '700' as const },
  dayLabelToday: { color: '#FFF' },
  dayNum:     { fontSize: 16, fontWeight: '800' as const, color: '#2D3748' },
  dayNumToday: { color: '#FFF' },
  dayDot:     { width: 8, height: 8, borderRadius: 4 },
  weekLegend: { fontSize: 11, color: '#6B46C1', marginTop: 8, paddingHorizontal: 8, flexDirection: 'row' as const, alignItems: 'center' as const },
  legendDot:  { width: 8, height: 8, borderRadius: 4, display: 'inline-flex' as any },

  // Humeur
  moodRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, padding: 8 },
  moodBtn: { alignItems: 'center' as const, padding: 8, borderRadius: 12, minWidth: 48 },
  moodEmoji:   { fontSize: 32 },
  moodLabel:   { fontSize: 9, fontWeight: '700' as const, marginTop: 4, textAlign: 'center' as const },
  moodConfirm: { fontSize: 12, color: CHILD_GREEN, fontWeight: '600' as const, marginTop: 8, paddingHorizontal: 4 },

  // Checklist
  checkRow:    { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: CHILD_BORDER },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: CHILD_BORDER, justifyContent: 'center' as const, alignItems: 'center' as const },
  checkboxChecked: { backgroundColor: CHILD_GREEN, borderColor: CHILD_GREEN },
  checkEmoji:  { fontSize: 18 },
  checkLabel:  { flex: 1, fontSize: 14, color: '#2D3748', fontWeight: '500' as const },
  checkLabelDone: { textDecorationLine: 'line-through' as const, color: '#A0AEC0' },
  progressBar: { height: 6, backgroundColor: CHILD_BORDER, borderRadius: 3, marginTop: 12, overflow: 'hidden' as const },
  progressFill: { height: '100%', backgroundColor: CHILD_GREEN, borderRadius: 3 },
  progressText: { fontSize: 12, color: '#6B46C1', marginTop: 6, textAlign: 'right' as const, fontWeight: '600' as const },

  // Journal
  journalHint:  { fontSize: 12, color: '#9F7AEA', marginBottom: 10, fontStyle: 'italic' as const },
  journalInput: {
    minHeight: 130, fontSize: 14, color: '#2D3748',
    backgroundColor: '#FAF5FF', borderRadius: 10,
    borderWidth: 1, borderColor: CHILD_BORDER,
    padding: 12, lineHeight: 22,
  },
  saveBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
    backgroundColor: CHILD_PURPLE, borderRadius: 10, paddingVertical: 12, marginTop: 10,
  },
  saveBtnDone: { backgroundColor: CHILD_GREEN },
  saveBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#FFF' },

  // Sélecteur d'âge
  ageSelector: {
    flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 8,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: CHILD_BORDER,
  },
  ageBtn: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, backgroundColor: CHILD_LIGHT,
    borderWidth: 1, borderColor: CHILD_BORDER,
  },
  ageBtnActive: {
    backgroundColor: CHILD_PURPLE, borderColor: CHILD_PURPLE,
  },
  ageBtnText: {
    fontSize: 12, fontWeight: '700' as const, color: CHILD_PURPLE,
  },
  ageBtnTextActive: {
    color: '#FFF',
  },
});
