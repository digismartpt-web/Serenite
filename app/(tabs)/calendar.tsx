import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Switch,
} from 'react-native';
import { Ionicons }             from '@expo/vector-icons';
import { useSafeAreaInsets }    from 'react-native-safe-area-context';
import DateTimePicker            from '@react-native-community/datetimepicker';

import { useTheme }  from '../context/ThemeContext';
import { useAuth }   from '../hooks/useAuth';
import { useTranslation, tList, weekDays, shortMonths } from '../../i18n/useTranslation';
import { type LangCode } from '../../i18n/translations';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────

type Category = 'visite' | 'vacances' | 'scolaire' | 'medical' | 'activite' | 'autre';

interface CalEvent {
  id:                  string;
  title:               string;
  description:         string | null;
  start_at:            string;
  end_at:              string;
  all_day:             boolean;
  category:            Category;
  color:               string | null;
  created_by:          string;
  creator_first_name:  string;
}

// ─── Config catégories ────────────────────────────────────────

const CATEGORIES: Record<Category, { emoji: string; color: string }> = {
  visite:    { emoji: '🏠', color: '#1A3A5C' },
  vacances:  { emoji: '🌴', color: '#0D5060' },
  scolaire:  { emoji: '📚', color: '#4A3580' },
  medical:   { emoji: '🏥', color: '#8C2B1E' },
  activite:  { emoji: '⚽', color: '#276749' },
  autre:     { emoji: '📌', color: '#5A7499' },
};

type EventType = 'medical' | 'vacation' | 'school' | 'other';

const EVENT_TYPES: Record<EventType, { emoji: string }> = {
  medical:  { emoji: '🏥' },
  vacation: { emoji: '🌴' },
  school:   { emoji: '📚' },
  other:    { emoji: '📌' },
};

// ─── Utilitaires date ─────────────────────────────────────────

function isoDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function startOfWeekISO(d: Date): number {
  // 0=lun … 6=dim
  return (d.getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateFR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Composant : grille mensuelle ─────────────────────────────

interface GridProps {
  year:        number;
  month:       number; // 0-indexed
  events:      CalEvent[];
  selectedDay: string | null;
  onDayPress:  (key: string) => void;
  theme:       ReturnType<typeof useTheme>['theme'];
  lang:        LangCode;
}

function MonthGrid({ year, month, events, selectedDay, onDayPress, theme, lang }: GridProps) {
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const key = ev.start_at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const today = isoDateKey(new Date());
  const firstDay = startOfMonth(year, month);
  const offset   = startOfWeekISO(firstDay); // blank cells at start
  const total    = daysInMonth(year, month);
  const cells    = offset + total;
  const rows     = Math.ceil(cells / 7);
  const days     = weekDays(lang);

  return (
    <View>
      {/* En-têtes jours */}
      <View style={gridStyles.header}>
        {days.map((j) => (
          <Text key={j} style={[gridStyles.headerCell, { color: theme.textSecondary }]}>{j}</Text>
        ))}
      </View>

      {/* Grille */}
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={gridStyles.row}>
          {Array.from({ length: 7 }).map((_, col) => {
            const cellIndex = row * 7 + col;
            const dayNum    = cellIndex - offset + 1;
            if (dayNum < 1 || dayNum > total) {
              return <View key={col} style={gridStyles.cell} />;
            }
            const dateKey  = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayEvs   = eventsByDay.get(dateKey) ?? [];
            const isToday  = dateKey === today;
            const isSel    = dateKey === selectedDay;

            return (
              <TouchableOpacity
                key={col}
                style={gridStyles.cell}
                onPress={() => onDayPress(dateKey)}
                activeOpacity={0.7}
              >
                <View style={[
                  gridStyles.dayInner,
                  isToday && { backgroundColor: theme.primary },
                  isSel && !isToday && { backgroundColor: theme.surfaceAlt, borderColor: theme.primary, borderWidth: 1.5 },
                ]}>
                  <Text style={[
                    gridStyles.dayNum,
                    { color: isToday ? '#FFF' : theme.text },
                    col >= 5 && !isToday && { color: theme.danger },
                  ]}>
                    {dayNum}
                  </Text>
                </View>
                {/* Dots événements (max 3) */}
                {dayEvs.length > 0 && (
                  <View style={gridStyles.dots}>
                    {dayEvs.slice(0, 3).map((ev, i) => (
                      <View
                        key={i}
                        style={[
                          gridStyles.dot,
                          { backgroundColor: ev.color ?? CATEGORIES[ev.category]?.color ?? theme.primary },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  header:     { flexDirection: 'row', paddingVertical: 6 },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  row:        { flexDirection: 'row' },
  cell:       { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayInner: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNum: { fontSize: 14, fontWeight: '500' },
  dots:   { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:    { width: 5, height: 5, borderRadius: 2.5 },
});

// ─── Formulaire ajout d'événement ─────────────────────────────

interface AddEventFormProps {
  familyId:  string;
  token:     string;
  initDate:  string;
  onSaved:   () => void;
  onClose:   () => void;
  theme:     ReturnType<typeof useTheme>['theme'];
  t:         (key: string, vars?: Record<string, string | number>) => string;
  lang:      LangCode;
}

function AddEventForm({ familyId, token, initDate, onSaved, onClose, theme, t, lang }: AddEventFormProps) {
  const [title,    setTitle]    = useState('');
  const [category, setCategory] = useState<Category>('visite');
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [allDay,   setAllDay]   = useState(true);
  const [startAt,  setStartAt]  = useState(new Date(`${initDate}T08:00:00`));
  const [endAt,    setEndAt]    = useState(new Date(`${initDate}T18:00:00`));
  const [showPicker, setShowPicker] = useState<'startDate' | 'startTime' | 'endDate' | 'endTime' | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) { setError(t('calendar.titleRequired')); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          familyId,
          title: title.trim(),
          startAt: allDay ? `${isoDateKey(startAt)}T00:00:00Z` : startAt.toISOString(),
          endAt:   allDay ? `${isoDateKey(endAt)}T23:59:59Z`   : endAt.toISOString(),
          allDay,
          category,
          eventType: eventType ?? undefined,
          childrenIds: [],
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? t('error')); return; }
      onSaved();
    } catch { setError(t('networkError')); }
    finally  { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[formStyles.sheet, { backgroundColor: theme.surface }]}>

        <View style={formStyles.handle} />

        <View style={formStyles.header}>
          <Text style={[formStyles.title, { color: theme.text }]}>{t('calendar.newEvent')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={formStyles.body} keyboardShouldPersistTaps="handled">

          {/* Titre */}
          <TextInput
            style={[formStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder={t('calendar.eventTitle')}
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          {/* Catégorie */}
          <Text style={[formStyles.label, { color: theme.textSecondary }]}>{t('calendar.category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(Object.keys(CATEGORIES) as Category[]).map((cat, idx) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    formStyles.catChip,
                    { borderColor: CATEGORIES[cat].color },
                    category === cat && { backgroundColor: CATEGORIES[cat].color },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={{ fontSize: 13 }}>{CATEGORIES[cat].emoji}</Text>
                  <Text style={[formStyles.catLabel, { color: category === cat ? '#FFF' : CATEGORIES[cat].color }]}>
                    {tList('calendar.categories', lang)[idx]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Type d'événement (optionnel) */}
          <Text style={[formStyles.label, { color: theme.textSecondary }]}>{t('calendar.type')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[
                  formStyles.catChip,
                  { borderColor: theme.border },
                  eventType === null && { backgroundColor: theme.primary },
                ]}
                onPress={() => setEventType(null)}
              >
                <Text style={[formStyles.catLabel, { color: eventType === null ? '#FFF' : theme.textSecondary }]}>
                  {t('calendar.none')}
                </Text>
              </TouchableOpacity>
              {(Object.keys(EVENT_TYPES) as EventType[]).map((et, idx) => (
                <TouchableOpacity
                  key={et}
                  style={[
                    formStyles.catChip,
                    { borderColor: theme.border },
                    eventType === et && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setEventType(et)}
                >
                  <Text style={{ fontSize: 13 }}>{EVENT_TYPES[et].emoji}</Text>
                  <Text style={[formStyles.catLabel, { color: eventType === et ? '#FFF' : theme.textSecondary }]}>
                    {tList('calendar.types', lang)[idx]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Journée entière */}
          <View style={formStyles.switchRow}>
            <Text style={[formStyles.label, { color: theme.text, marginBottom: 0 }]}>{t('calendar.fullDay')}</Text>
            <Switch
              value={allDay}
              onValueChange={setAllDay}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFF"
            />
          </View>

          {/* Dates */}
          <View style={formStyles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={[formStyles.label, { color: theme.textSecondary }]}>{t('calendar.start')}</Text>
              <TouchableOpacity
                style={[formStyles.dateBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
                onPress={() => setShowPicker('startDate')}
              >
                <Ionicons name="calendar-outline" size={14} color={theme.primary} />
                <Text style={{ color: theme.text, fontSize: 13 }}>
                  {startAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Text>
              </TouchableOpacity>
              {!allDay && (
                <TouchableOpacity
                  style={[formStyles.dateBtn, { borderColor: theme.border, backgroundColor: theme.background, marginTop: 6 }]}
                  onPress={() => setShowPicker('startTime')}
                >
                  <Ionicons name="time-outline" size={14} color={theme.primary} />
                  <Text style={{ color: theme.text, fontSize: 13 }}>{formatHour(startAt.toISOString())}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Ionicons name="arrow-forward" size={16} color={theme.textSecondary} style={{ marginTop: 28 }} />

            <View style={{ flex: 1 }}>
              <Text style={[formStyles.label, { color: theme.textSecondary }]}>{t('calendar.end')}</Text>
              <TouchableOpacity
                style={[formStyles.dateBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
                onPress={() => setShowPicker('endDate')}
              >
                <Ionicons name="calendar-outline" size={14} color={theme.primary} />
                <Text style={{ color: theme.text, fontSize: 13 }}>
                  {endAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Text>
              </TouchableOpacity>
              {!allDay && (
                <TouchableOpacity
                  style={[formStyles.dateBtn, { borderColor: theme.border, backgroundColor: theme.background, marginTop: 6 }]}
                  onPress={() => setShowPicker('endTime')}
                >
                  <Ionicons name="time-outline" size={14} color={theme.primary} />
                  <Text style={{ color: theme.text, fontSize: 13 }}>{formatHour(endAt.toISOString())}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Date/Time pickers (iOS inline, Android dialog) */}
          {showPicker && (
            <DateTimePicker
              value={
                showPicker === 'startDate' || showPicker === 'startTime' ? startAt : endAt
              }
              mode={showPicker.includes('Time') ? 'time' : 'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              locale="fr-FR"
              onChange={(_, d) => {
                if (!d) { setShowPicker(null); return; }
                if (showPicker === 'startDate' || showPicker === 'startTime') setStartAt(d);
                else setEndAt(d);
                if (Platform.OS === 'android') setShowPicker(null);
              }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <TouchableOpacity onPress={() => setShowPicker(null)} style={formStyles.pickerClose}>
              <Text style={{ color: theme.primary, fontWeight: '700' }}>{t('ok')}</Text>
            </TouchableOpacity>
          )}

          {error && (
            <View style={formStyles.errorBanner}>
              <Ionicons name="warning-outline" size={14} color="#C53030" />
              <Text style={formStyles.errorText}>{error}</Text>
            </View>
          )}

        </ScrollView>

        <TouchableOpacity
          style={[formStyles.saveBtn, { backgroundColor: loading ? theme.textSecondary : theme.primary }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Ionicons name="checkmark" size={18} color="#FFF" />
              <Text style={formStyles.saveBtnText}>{t('save')}</Text>
            </>
          )}
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const formStyles = StyleSheet.create({
  sheet:      { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E0', alignSelf: 'center', marginBottom: 12 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  title:      { fontSize: 18, fontWeight: '800' },
  body:       { padding: 20, gap: 0 },
  label:      { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, marginBottom: 16,
  },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  catLabel: { fontSize: 12, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dateRow:   { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  pickerClose: { alignItems: 'center', paddingVertical: 8 },
  errorBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 8, padding: 10 },
  errorText:   { color: '#C53030', fontSize: 13, flex: 1 },
  saveBtn: {
    margin: 20, borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

// ─── Écran principal Calendrier ───────────────────────────────

export default function CalendarScreen() {
  const insets        = useSafeAreaInsets();
  const { theme }     = useTheme();
  const { token, user } = useAuth();
  const { t, lang }   = useTranslation();

  const today      = new Date();
  const [year,  setYear]   = useState(today.getFullYear());
  const [month, setMonth]  = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(isoDateKey(today));
  const [events,   setEvents]   = useState<CalEvent[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);

  // ── Charger famille ────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/families/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setFamilyId(d.family?.id ?? null))
      .catch(() => {});
  }, [token]);

  // ── Charger événements du mois ────────────────────────────
  const loadEvents = useCallback(async (y: number, m: number) => {
    if (!token || !familyId) { setLoading(false); return; }
    setLoading(true);
    const from = new Date(y, m, 1).toISOString();
    const to   = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await fetch(
        `${API_BASE}/api/events?familyId=${familyId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) { const d = await res.json(); setEvents(d.events ?? []); }
    } catch {}
    finally { setLoading(false); }
  }, [token, familyId]);

  useEffect(() => { loadEvents(year, month); }, [year, month, familyId]);

  // ── Navigation mois ────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  // ── Événements du jour sélectionné ────────────────────────
  const dayEvents = useMemo(
    () => selectedDay ? events.filter((e) => e.start_at.slice(0, 10) === selectedDay) : [],
    [events, selectedDay]
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ─ Header ─ */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>{t('calendar.title')}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(isoDateKey(today)); }}
        >
          <Text style={styles.headerBtnText}>{t('calendar.today')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        {/* ─ Navigation mois ─ */}
        <View style={[styles.monthNav, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: theme.text }]}>
            {shortMonths(lang)[month]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* ─ Grille ─ */}
        <View style={[styles.gridContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <MonthGrid
              year={year} month={month}
              events={events}
              selectedDay={selectedDay}
              onDayPress={setSelectedDay}
              theme={theme}
              lang={lang}
            />
          )}
        </View>

        {/* ─ Événements du jour sélectionné ─ */}
        {selectedDay && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text style={[styles.dayTitle, { color: theme.text }]}>
              {formatDateFR(selectedDay + 'T12:00:00')}
            </Text>

            {dayEvents.length === 0 ? (
              <View style={[styles.emptyDay, { borderColor: theme.border }]}>
                <Text style={{ fontSize: 32 }}>📅</Text>
                <Text style={[styles.emptyDayText, { color: theme.textSecondary }]}>{t('calendar.noEvents')}</Text>
              </View>
            ) : (
              dayEvents.map((ev) => {
                const cat = CATEGORIES[ev.category];
                const evColor = ev.color ?? cat.color;
                const catIndex = (Object.keys(CATEGORIES) as Category[]).indexOf(ev.category);
                const catLabel = tList('calendar.categories', lang)[catIndex];
                return (
                  <View
                    key={ev.id}
                    style={[styles.eventCard, { backgroundColor: theme.surface, borderLeftColor: evColor }]}
                  >
                    <View style={styles.eventCardTop}>
                      <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.eventTitle, { color: theme.text }]}>{ev.title}</Text>
                        <Text style={[styles.eventMeta, { color: theme.textSecondary }]}>
                          {ev.all_day
                            ? t('calendar.allDay')
                            : `${formatHour(ev.start_at)} – ${formatHour(ev.end_at)}`}
                          {' · '}{ev.creator_first_name}
                        </Text>
                      </View>
                      <View style={[styles.catBadge, { backgroundColor: evColor + '22', borderColor: evColor }]}>
                        <Text style={[styles.catBadgeText, { color: evColor }]}>{catLabel}</Text>
                      </View>
                    </View>
                    {ev.description && (
                      <Text style={[styles.eventDesc, { color: theme.textSecondary }]}>{ev.description}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ─ Pas de famille ─ */}
        {!familyId && !loading && (
          <View style={styles.centered}>
            <Text style={{ fontSize: 48 }}>👨‍👩‍👧</Text>
            <Text style={[styles.noFamilyText, { color: theme.textSecondary }]}>
              {t('calendar.noFamily')}
            </Text>
          </View>
        )}

      </ScrollView>

      {/* ─ FAB Ajouter ─ */}
      {familyId && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 20 }]}
          onPress={() => setShowForm(true)}
          accessibilityLabel={t('calendar.newEvent')}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* ─ Modal formulaire ─ */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        {familyId && token && (
          <AddEventForm
            familyId={familyId}
            token={token}
            initDate={selectedDay ?? isoDateKey(today)}
            onSaved={() => { setShowForm(false); loadEvents(year, month); }}
            onClose={() => setShowForm(false)}
            theme={theme}
            t={t}
            lang={lang}
          />
        )}
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:     { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerBtn:     { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 12, paddingVertical: 5 },
  headerBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  // Navigation mois
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  navBtn:     { padding: 8 },
  monthLabel: { fontSize: 17, fontWeight: '800' },

  // Grille
  gridContainer: { paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  loadingRow: { height: 200, justifyContent: 'center', alignItems: 'center' },

  // Événements du jour
  dayTitle:  { fontSize: 15, fontWeight: '700', marginBottom: 12, textTransform: 'capitalize' },
  emptyDay: {
    alignItems: 'center', gap: 8, padding: 24,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12,
  },
  emptyDayText: { fontSize: 14 },

  eventCard: {
    borderLeftWidth: 4, borderRadius: 10, padding: 12, marginBottom: 10,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  eventCardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  eventTitle:   { fontSize: 15, fontWeight: '700' },
  eventMeta:    { fontSize: 12, marginTop: 2 },
  eventDesc:    { fontSize: 13, marginTop: 6, lineHeight: 18 },
  catBadge:     { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },

  // Pas de famille
  centered:     { alignItems: 'center', padding: 32, gap: 12, marginTop: 32 },
  noFamilyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // FAB
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
});
