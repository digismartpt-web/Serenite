import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, ActivityIndicator,
  KeyboardAvoidingView, Animated,
} from 'react-native';
import { useRouter }         from 'expo-router';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../hooks/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────

type Phase = 'draft' | 'reformulating' | 'review';

interface ReformulateResult {
  reformulatedContent: string;
  aggressivenessScore: number;
  pauseRequired:       boolean;
  pauseExpiresAt:      string | null;
}

// ─── Countdown Timer ──────────────────────────────────────────

function useCountdown(expiresAt: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) { setLabel(null); return; }

    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setLabel(null); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${m}:${String(s).padStart(2, '0')}`);
    }

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

// ─── Barre d'agressivité ──────────────────────────────────────

function AggressivenessBar({ score }: { score: number }) {
  const { t } = useTranslation();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: score, damping: 12, stiffness: 80, useNativeDriver: false }).start();
  }, [score]);

  const color = score > 0.7 ? '#E53E3E' : score > 0.4 ? '#D97706' : '#1D9E75';
  const label = score > 0.7 ? t('compose.aggressive') : score > 0.4 ? t('compose.tense') : t('compose.neutral');

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={aggrStyles.wrapper}>
      <View style={aggrStyles.row}>
        <Text style={[aggrStyles.label, { color }]}>{label}</Text>
        <Text style={[aggrStyles.score, { color }]}>{Math.round(score * 100)}%</Text>
      </View>
      <View style={aggrStyles.track}>
        <Animated.View style={[aggrStyles.fill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const aggrStyles = StyleSheet.create({
  wrapper: { gap: 5 },
  row:     { flexDirection: 'row', justifyContent: 'space-between' },
  label:   { fontSize: 12, fontWeight: '700' },
  score:   { fontSize: 12, fontWeight: '700' },
  track:   { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 3 },
});

// ─── Écran Compose ────────────────────────────────────────────

export default function ComposeScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const { t } = useTranslation();

  const [familyId,     setFamilyId]     = useState<string | null>(null);
  const [phase,        setPhase]        = useState<Phase>('draft');
  const [draftText,    setDraftText]    = useState('');
  const [reformulated, setReformulated] = useState('');
  const [isEditing,    setIsEditing]    = useState(false);
  const [result,       setResult]       = useState<ReformulateResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [sending,      setSending]      = useState(false);

  const countdown = useCountdown(result?.pauseRequired ? result.pauseExpiresAt : null);
  const canSend   = !result?.pauseRequired || countdown === null;

  // Charger l'ID famille au montage
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/families/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setFamilyId(d.family?.id ?? null))
      .catch(() => {});
  }, [token]);

  // ── Reformuler ────────────────────────────────────────────
  async function handleReformulate() {
    if (!draftText.trim() || !token || !familyId) return;
    setPhase('reformulating');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/messages/reformulate`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({ content: draftText.trim(), familyId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t('compose.err.reformulation'));
        setPhase('draft');
        return;
      }

      setResult(data as ReformulateResult);
      setReformulated(data.reformulatedContent);
      setPhase('review');
    } catch {
      setError(t('compose.err.server'));
      setPhase('draft');
    }
  }

  // ── Envoyer ───────────────────────────────────────────────
  async function handleSend() {
    if (!token || !familyId || !canSend) return;

    const contentToSend = phase === 'review' ? reformulated : draftText;
    if (!contentToSend.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/messages/send`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          content:             contentToSend.trim(),
          familyId,
          originalContent:     phase === 'review' ? draftText : undefined,
          isReformulated:      phase === 'review',
          aggressivenessScore: result?.aggressivenessScore,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        // Pause en cours ?
        if (res.status === 429) {
          setError(t('compose.err.pause'));
        } else {
          setError(data.error ?? t('compose.err.send'));
        }
        return;
      }

      // Succès → retour à la liste
      router.back();
    } catch {
      setError(t('compose.err.sendNet'));
    } finally {
      setSending(false);
    }
  }

  // ── Rendu ─────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.root, { backgroundColor: theme.background }]}>

        {/* ─ Header ─ */}
        <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel={t('back')}
          >
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('messages.newMessage')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >

          {/* ─ Zone brouillon (rouge pâle) ─ */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('compose.yourMessage')}</Text>
            </View>

            <View style={styles.draftZone}>
              <TextInput
                style={styles.draftInput}
                value={draftText}
                onChangeText={setDraftText}
                placeholder={t('compose.placeholder')}
                placeholderTextColor="#B0807A"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                editable={phase !== 'reformulating'}
                accessibilityLabel={t('compose.inputAria')}
              />
            </View>

            {/* Score agressivité en temps réel (si message reformulé) */}
            {phase === 'review' && result && (
              <AggressivenessBar score={result.aggressivenessScore} />
            )}
          </View>

          {/* ─ Flèche de transition ─ */}
          {phase !== 'draft' && (
            <View style={styles.arrowRow}>
              <View style={[styles.arrowLine, { backgroundColor: theme.border }]} />
              <View style={[styles.arrowCircle, { backgroundColor: theme.primary }]}>
                {phase === 'reformulating' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                )}
              </View>
              <View style={[styles.arrowLine, { backgroundColor: theme.border }]} />
            </View>
          )}

          {/* ─ Zone reformulée (vert pâle) ─ */}
          {(phase === 'reformulating' || phase === 'review') && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.aiBadge]}>
                  <Ionicons name="sparkles" size={11} color="#276749" />
                  <Text style={styles.aiBadgeText}>{t('voice.aiCnvBadge')}</Text>
                </View>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('compose.reformulated')}</Text>
              </View>

              <View style={styles.reformulatedZone}>
                {phase === 'reformulating' ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#276749" />
                    <Text style={styles.loadingText}>{t('compose.reformulating')}</Text>
                  </View>
                ) : (
                  <TextInput
                    style={styles.reformulatedInput}
                    value={reformulated}
                    onChangeText={setReformulated}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    editable={isEditing}
                    accessibilityLabel={t('compose.reformulated')}
                  />
                )}
              </View>

              {/* Timer de pause */}
              {phase === 'review' && result?.pauseRequired && countdown !== null && (
                <View style={styles.timerBanner}>
                  <Ionicons name="timer-outline" size={18} color="#8C2B1E" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timerTitle}>{t('compose.pauseTitle')}</Text>
                    <Text style={styles.timerBody}>
                      {t('compose.pauseBody')}
                    </Text>
                  </View>
                  <Text style={styles.timerCountdown}>{countdown}</Text>
                </View>
              )}
            </View>
          )}

          {/* ─ Erreur ─ */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={16} color="#C53030" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

        </ScrollView>

        {/* ─ Actions bas ─ */}
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>

          {/* Bouton Reformuler (phase draft) */}
          {phase === 'draft' && (
            <TouchableOpacity
              style={[
                styles.actionBtn, styles.actionBtnPrimary,
                { backgroundColor: theme.primary },
                !draftText.trim() && styles.actionBtnDisabled,
              ]}
              onPress={handleReformulate}
              disabled={!draftText.trim() || !familyId}
              activeOpacity={0.85}
              accessibilityLabel={t('compose.reformulateAria')}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnPrimaryText}>{t('compose.reformulate')}</Text>
            </TouchableOpacity>
          )}

          {/* Boutons phase review */}
          {phase === 'review' && (
            <View style={styles.reviewActions}>

              {/* Recommencer */}
              <TouchableOpacity
                style={[styles.actionBtnGhost, { borderColor: theme.border }]}
                onPress={() => { setPhase('draft'); setResult(null); setIsEditing(false); }}
                accessibilityLabel={t('compose.restart')}
              >
                <Ionicons name="refresh" size={16} color={theme.textSecondary} />
                <Text style={[styles.actionBtnGhostText, { color: theme.textSecondary }]}>{t('compose.restart')}</Text>
              </TouchableOpacity>

              {/* Modifier */}
              <TouchableOpacity
                style={[
                  styles.actionBtnGhost,
                  { borderColor: isEditing ? theme.accent : theme.border },
                  isEditing && { backgroundColor: '#EDF7F3' },
                ]}
                onPress={() => setIsEditing((e) => !e)}
                accessibilityLabel={isEditing ? t('compose.finishEditing') : t('compose.editText')}
              >
                <Ionicons name={isEditing ? 'checkmark' : 'pencil'} size={16} color={isEditing ? '#276749' : theme.textSecondary} />
                <Text style={[styles.actionBtnGhostText, { color: isEditing ? '#276749' : theme.textSecondary }]}>
                  {isEditing ? t('compose.validate') : t('compose.edit')}
                </Text>
              </TouchableOpacity>

              {/* Envoyer */}
              <TouchableOpacity
                style={[
                  styles.actionBtnSend,
                  { backgroundColor: canSend ? '#276749' : '#A0AEC0' },
                ]}
                onPress={handleSend}
                disabled={!canSend || sending || !familyId}
                accessibilityLabel={t('compose.sendAria')}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnSendText}>{t('compose.send')}</Text>
                  </>
                )}
              </TouchableOpacity>

            </View>
          )}

          {/* Envoi sans reformulation */}
          {phase === 'draft' && draftText.trim().length > 0 && (
            <TouchableOpacity
              style={styles.sendDirectLink}
              onPress={handleSend}
              disabled={sending}
            >
              <Text style={[styles.sendDirectLinkText, { color: theme.textSecondary }]}>
                {t('compose.sendDirect')}
              </Text>
            </TouchableOpacity>
          )}

        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: { padding: 20, gap: 16 },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  // ── Section
  section:       { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#E53E3E',
  },
  sectionLabel:  { fontSize: 13, fontWeight: '700' },

  // ── Zone brouillon (rouge pâle)
  draftZone: {
    backgroundColor: '#FCEBEB',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#FEB2B2',
    padding: 14,
    ...Platform.select({
      ios:     { shadowColor: '#E53E3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  draftInput: {
    fontSize: 16, color: '#742A2A', lineHeight: 24,
    minHeight: 120,
  },

  // ── Flèche
  arrowRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  arrowLine:   { flex: 1, height: 1 },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Zone reformulée (vert pâle)
  reformulatedZone: {
    backgroundColor: '#EAF3DE',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#9AE6B4',
    padding: 14,
    ...Platform.select({
      ios:     { shadowColor: '#1D9E75', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  reformulatedInput: {
    fontSize: 16, color: '#276749', lineHeight: 24,
    minHeight: 120,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 80, justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#276749', fontWeight: '600' },

  // ── Badge IA
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EDF7F3', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  aiBadgeText: { fontSize: 11, color: '#276749', fontWeight: '800' },

  // ── Timer pause
  timerBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF5F5', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FEB2B2',
  },
  timerTitle:     { fontSize: 13, fontWeight: '700', color: '#8C2B1E' },
  timerBody:      { fontSize: 12, color: '#C53030', lineHeight: 16, marginTop: 2 },
  timerCountdown: { fontSize: 20, fontWeight: '800', color: '#8C2B1E', minWidth: 52, textAlign: 'right' },

  // ── Erreur
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF5F5', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FEB2B2',
  },
  errorText: { flex: 1, fontSize: 13, color: '#C53030', lineHeight: 18 },

  // ── Actions
  actions: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, gap: 10,
    backgroundColor: 'transparent',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 15,
  },
  actionBtnPrimary: {},
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  reviewActions: { flexDirection: 'row', gap: 10 },
  actionBtnGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: 10, paddingVertical: 12, borderWidth: 1.5,
  },
  actionBtnGhostText: { fontSize: 13, fontWeight: '600' },
  actionBtnSend: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, paddingVertical: 12,
  },
  actionBtnSendText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sendDirectLink: { alignItems: 'center', paddingVertical: 4 },
  sendDirectLinkText: { fontSize: 13 },
});
