import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Platform, Alert, Linking, Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constantes ───────────────────────────────────────────────

const CHILD_PURPLE  = '#5B3FA0';
const CHILD_DARK    = '#3D2870';
const CHILD_LIGHT   = '#FAF5FF';
const CHILD_BORDER  = '#E9D8FD';
const CHILD_ACCENT  = '#F6AD55';
const CHILD_GREEN   = '#48BB78';

const DAYS_SHORT    = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOODS         = ['😞', '😕', '😐', '🙂', '😄'];
const MOOD_LABELS   = ['Triste', 'Pas bien', 'Normal', 'Bien', 'Super !'];
const MOOD_COLORS   = ['#FC8181', '#F6AD55', '#90CDF4', '#68D391', '#F6E05E'];

const JOURNAL_KEY   = '@serenite/child_journal';
const MOOD_KEY      = '@serenite/child_mood';
const CHECKLIST_KEY = '@serenite/child_checklist';

// ─── Items checklist sac ──────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: 'school',    label: 'Affaires de school', emoji: '📚' },
  { id: 'sport',     label: 'Tenue de sport',     emoji: '👟' },
  { id: 'pyjama',   label: 'Pyjama',              emoji: '🌙' },
  { id: 'doudou',   label: 'Doudou / Peluche',    emoji: '🧸' },
  { id: 'charger',  label: 'Chargeur téléphone',  emoji: '🔌' },
  { id: 'medicine', label: 'Médicaments',          emoji: '💊' },
  { id: 'money',    label: 'Argent de poche',      emoji: '💰' },
];

// ─── Utilitaires ──────────────────────────────────────────────

function getWeekDays(): { date: Date; label: string; dayNum: number; isToday: boolean }[] {
  const today = new Date();
  const day   = today.getDay(); // 0=dimanche
  // Début de semaine = lundi
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return DAYS_SHORT.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    return {
      date:    d,
      label,
      dayNum:  d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
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

  // Humeur
  const [mood, setMood]               = useState<number | null>(null);
  // Journal
  const [journalText, setJournalText] = useState('');
  const [journalSaved, setJournalSaved] = useState(false);
  // Checklist
  const [checked, setChecked]         = useState<Record<string, boolean>>({});

  const weekDays = getWeekDays();

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

  // ── Appel parent ──────────────────────────────────────────────
  function callParent(who: 'papa' | 'maman') {
    Alert.alert(
      `Appeler ${who === 'papa' ? 'Papa' : 'Maman'}`,
      `Veux-tu appeler ${who === 'papa' ? 'Papa' : 'Maman'} maintenant ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, appeler !',
          onPress: () => {
            // En prod, on utiliserait le numéro réel depuis l'API famille
            Alert.alert('Appel en cours…', `Connexion avec ${who === 'papa' ? 'Papa' : 'Maman'}`);
          },
        },
      ]
    );
  }

  const today = new Date();
  const todayStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: CHILD_LIGHT }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Bonjour ── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>🌟</Text>
        <Text style={styles.heroTitle}>Bonjour !</Text>
        <Text style={styles.heroDate}>{todayStr}</Text>
      </View>

      {/* ── Appels parents ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appeler</Text>
        <View style={styles.callRow}>
          <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#2B6CB0' }]} onPress={() => callParent('papa')}>
            <Text style={styles.callEmoji}>👨</Text>
            <Text style={styles.callLabel}>Papa</Text>
            <Ionicons name="call" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#702459' }]} onPress={() => callParent('maman')}>
            <Text style={styles.callEmoji}>👩</Text>
            <Text style={styles.callLabel}>Maman</Text>
            <Ionicons name="call" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Calendrier semaine ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ma semaine</Text>
        <View style={[styles.card, styles.weekRow]}>
          {weekDays.map((d, i) => (
            <View key={i} style={[styles.dayCell, d.isToday && styles.dayCellToday]}>
              <Text style={[styles.dayLabel, d.isToday && styles.dayLabelToday]}>{d.label}</Text>
              <Text style={[styles.dayNum, d.isToday && styles.dayNumToday]}>{d.dayNum}</Text>
              {/* Indicateur parent : alternance symbolique */}
              <View style={[
                styles.dayDot,
                { backgroundColor: i % 2 === 0 ? '#2B6CB0' : '#702459' },
              ]} />
            </View>
          ))}
        </View>
        <Text style={styles.weekLegend}>
          <View style={[styles.legendDot, { backgroundColor: '#2B6CB0' }]} /> Papa &nbsp;&nbsp;
          <View style={[styles.legendDot, { backgroundColor: '#702459' }]} /> Maman
        </Text>
      </View>

      {/* ── Humeur ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comment tu te sens ?</Text>
        <View style={[styles.card, styles.moodRow]}>
          {MOODS.map((emoji, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.moodBtn,
                mood === i && { backgroundColor: MOOD_COLORS[i] + '33', borderColor: MOOD_COLORS[i], borderWidth: 2 },
              ]}
              onPress={() => handleMood(i)}
              activeOpacity={0.7}
            >
              <Text style={styles.moodEmoji}>{emoji}</Text>
              {mood === i && (
                <Text style={[styles.moodLabel, { color: MOOD_COLORS[i] }]}>{MOOD_LABELS[i]}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        {mood !== null && (
          <Text style={styles.moodConfirm}>Humeur enregistrée pour aujourd'hui ✓</Text>
        )}
      </View>

      {/* ── Checklist sac ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mon sac est prêt ?</Text>
        <View style={styles.card}>
          {CHECKLIST_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.checkRow}
              onPress={() => toggleCheck(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, checked[item.id] && styles.checkboxChecked]}>
                {checked[item.id] && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.checkEmoji}>{item.emoji}</Text>
              <Text style={[styles.checkLabel, checked[item.id] && styles.checkLabelDone]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Barre de progression */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(Object.values(checked).filter(Boolean).length / CHECKLIST_ITEMS.length) * 100}%` as any,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Object.values(checked).filter(Boolean).length} / {CHECKLIST_ITEMS.length} articles
          </Text>
        </View>
      </View>

      {/* ── Journal privé ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mon journal secret 🔒</Text>
        <View style={styles.card}>
          <Text style={styles.journalHint}>Écris ce que tu ressens… personne d'autre ne peut lire ça.</Text>
          <TextInput
            style={styles.journalInput}
            multiline
            numberOfLines={6}
            placeholder="Aujourd'hui j'ai…"
            placeholderTextColor="#C4B5FD"
            value={journalText}
            onChangeText={setJournalText}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveBtn, journalSaved && styles.saveBtnDone]}
            onPress={saveJournal}
          >
            <Ionicons name={journalSaved ? 'checkmark-circle' : 'save-outline'} size={18} color="#FFF" />
            <Text style={styles.saveBtnText}>{journalSaved ? 'Sauvegardé !' : 'Sauvegarder'}</Text>
          </TouchableOpacity>
        </View>
      </View>

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
  weekRow:    { flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
  dayCell:    { alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 10 },
  dayCellToday: { backgroundColor: CHILD_PURPLE },
  dayLabel:   { fontSize: 10, color: '#6B46C1', fontWeight: '700' },
  dayLabelToday: { color: '#FFF' },
  dayNum:     { fontSize: 16, fontWeight: '800', color: '#2D3748' },
  dayNumToday: { color: '#FFF' },
  dayDot:     { width: 8, height: 8, borderRadius: 4 },
  weekLegend: { fontSize: 11, color: '#6B46C1', marginTop: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  legendDot:  { width: 8, height: 8, borderRadius: 4, display: 'inline-flex' as any },

  // Humeur
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 8 },
  moodBtn: { alignItems: 'center', padding: 8, borderRadius: 12, minWidth: 48 },
  moodEmoji:   { fontSize: 32 },
  moodLabel:   { fontSize: 9, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  moodConfirm: { fontSize: 12, color: CHILD_GREEN, fontWeight: '600', marginTop: 8, paddingHorizontal: 4 },

  // Checklist
  checkRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: CHILD_BORDER },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: CHILD_BORDER, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: CHILD_GREEN, borderColor: CHILD_GREEN },
  checkEmoji:  { fontSize: 18 },
  checkLabel:  { flex: 1, fontSize: 14, color: '#2D3748', fontWeight: '500' },
  checkLabelDone: { textDecorationLine: 'line-through', color: '#A0AEC0' },
  progressBar: { height: 6, backgroundColor: CHILD_BORDER, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: CHILD_GREEN, borderRadius: 3 },
  progressText: { fontSize: 12, color: '#6B46C1', marginTop: 6, textAlign: 'right', fontWeight: '600' },

  // Journal
  journalHint:  { fontSize: 12, color: '#9F7AEA', marginBottom: 10, fontStyle: 'italic' },
  journalInput: {
    minHeight: 130, fontSize: 14, color: '#2D3748',
    backgroundColor: '#FAF5FF', borderRadius: 10,
    borderWidth: 1, borderColor: CHILD_BORDER,
    padding: 12, lineHeight: 22,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: CHILD_PURPLE, borderRadius: 10, paddingVertical: 12, marginTop: 10,
  },
  saveBtnDone: { backgroundColor: CHILD_GREEN },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
