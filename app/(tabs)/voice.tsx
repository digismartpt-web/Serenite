import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Platform, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { useRouter }            from 'expo-router';
import { Ionicons }             from '@expo/vector-icons';
import { useSafeAreaInsets }    from 'react-native-safe-area-context';
// expo-file-system pas nécessaire — on utilise fetch pour lire le fichier local
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../hooks/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────

type Phase = 'idle' | 'recording' | 'uploading' | 'review' | 'reformulating';

// ─── Animation de niveau sonore ────────────────────────────────

function MeteringBar({ metering }: { metering?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const meterValue = metering ?? -160; // -160 = silence complet
  // Convertir dB en échelle 0..1 (généralement -60..0 dB pour la voix)
  const normalized = Math.min(Math.max((meterValue + 60) / 60, 0), 1);

  useEffect(() => {
    Animated.spring(anim, { toValue: normalized, damping: 8, stiffness: 100, useNativeDriver: false }).start();
  }, [normalized]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] });
  const color = normalized > 0.7 ? '#E53E3E' : normalized > 0.4 ? '#D97706' : '#38A169';

  return (
    <View style={meterStyles.wrapper}>
      <View style={[meterStyles.track, { backgroundColor: '#E2E8F0' }]}>
        <Animated.View style={[meterStyles.fill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const meterStyles = StyleSheet.create({
  wrapper: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  track:   { flex: 1, borderRadius: 4, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 4 },
});

// ─── Écran Messagerie Vocale ───────────────────────────────────

export default function VoiceScreen() {
  const router        = useRouter();
  const insets        = useSafeAreaInsets();
  const { theme }     = useTheme();
  const { token, user } = useAuth();
  const { t }         = useTranslation();

  const [phase,         setPhase]         = useState<Phase>('idle');
  const [familyId,      setFamilyId]      = useState<string | null>(null);
  const [transcribed,   setTranscribed]   = useState('');
  const [reformulated,  setReformulated]  = useState('');
  const [error,         setError]         = useState<string | null>(null);
  const [sending,       setSending]       = useState(false);
  const [timer,         setTimer]         = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);

  // ── Audio Recorder ──────────────────────────────────────────
  const recorder = useAudioRecorder(
    {
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
      extension: '.m4a',
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 64000,
      android: {
        outputFormat: 'mpeg4',
        audioEncoder: 'aac',
        audioSource: 'mic',
      },
      ios: {
        outputFormat: 'aac ',
        audioQuality: 0x60,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 64000,
      },
    },
    useCallback((status) => {
      if (status.isFinished && status.url) {
        uploadAudio(status.url);
      }
    }, [])
  );

  const recorderState = useAudioRecorderState(recorder, 200);

  // ── Timer d'enregistrement ─────────────────────────────────
  useEffect(() => {
    if (phase === 'recording') {
      if (!timerRef.current) {
        recordingStartRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setTimer(Math.floor((Date.now() - recordingStartRef.current) / 1000));
        }, 200);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (phase === 'idle') setTimer(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── Charger la famille au montage ───────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/families/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setFamilyId(d.family?.id ?? null))
      .catch(() => {});
  }, [token]);

  // ── Démarrer l'enregistrement ───────────────────────────────
  async function handleStartRecording() {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError(t('voice.err.micPermission'));
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (err) {
      setError(t('voice.err.micAccess'));
      setPhase('idle');
    }
  }

  // ── Arrêter l'enregistrement ────────────────────────────────
  async function handleStopRecording() {
    if (phase !== 'recording') return;
    setPhase('uploading');
    try {
      await recorder.stop();
      // Le callback de statusListener gère la suite (uploadAudio)
    } catch (err) {
      setError(t('voice.err.stopError'));
      setPhase('idle');
    }
  }

  // ── Upload de l'audio vers /api/voice/transcribe ───────────
  async function uploadAudio(uri: string) {
    setError(null);
    try {
      // Lire le fichier local via fetch et l'envoyer comme FormData
      const audioFile = await fetch(uri);
      const blob = await audioFile.blob();

      const formData = new FormData();
      formData.append('audio', blob, 'recording.m4a');

      const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Ne PAS mettre Content-Type — fetch le déduit avec boundary
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('voice.err.transcription'));
        setPhase('idle');
        return;
      }

      setTranscribed(data.transcribedText);
      setPhase('review');
    } catch (err) {
      setError(t('voice.err.transcriptionNet'));
      setPhase('idle');
    }
  }

  // ── Reformuler ──────────────────────────────────────────────
  async function handleReformulate() {
    if (!transcribed.trim() || !token) return;
    setPhase('reformulating');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/voice/reformulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: transcribed.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('voice.err.reformulation'));
        setPhase('review');
        return;
      }

      setReformulated(data.reformulatedText);
      setPhase('review');
    } catch {
      setError(t('voice.err.reformulationNet'));
      setPhase('review');
    }
  }

  // ── Envoyer le message reformulé ────────────────────────────
  async function handleSend() {
    if (!token || !familyId) return;
    const contentToSend = reformulated || transcribed;
    if (!contentToSend.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: contentToSend.trim(),
          familyId,
          originalContent: transcribed,
          isReformulated: !!reformulated,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t('voice.err.send'));
        return;
      }

      // Retour à l'accueil après envoi réussi
      router.back();
    } catch {
      setError(t('voice.err.sendNet'));
    } finally {
      setSending(false);
    }
  }

  // ── Format du timer ─────────────────────────────────────────
  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ── Rendu ───────────────────────────────────────────────────

  return (
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
        <Text style={styles.headerTitle}>{t('voice.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ─ Zone d'enregistrement ─ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mic" size={18} color={phase === 'recording' ? '#E53E3E' : theme.text} />
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              {phase === 'recording' ? t('voice.recordingInProgress') : t('voice.recording')}
            </Text>
          </View>

          {/* Bouton d'enregistrement (maintenir enfoncé) */}
          <View style={styles.recordButtonArea}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                phase === 'recording' && styles.recordButtonActive,
                (phase !== 'idle' && phase !== 'recording') && { opacity: 0.5 },
              ]}
              onPressIn={handleStartRecording}
              onPressOut={handleStopRecording}
              disabled={phase !== 'idle' && phase !== 'recording'}
              accessibilityLabel={phase === 'recording' ? t('voice.releaseToStop') : t('voice.pressToRecord')}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Ionicons
                name={phase === 'recording' ? 'mic' : 'mic-outline'}
                size={36}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Timer */}
            {phase === 'recording' && (
              <Text style={styles.timerText}>{formatTimer(timer)}</Text>
            )}

            {/* Indicateur "Appuyer / Relâcher" */}
            <Text style={[styles.hintText, { color: theme.textSecondary }]}>
              {phase === 'recording'
                ? t('voice.releaseToStop')
                : phase === 'uploading'
                ? t('voice.transcribing')
                : t('voice.holdToRecord')}
            </Text>
          </View>

          {/* Barre de niveau sonore */}
          {phase === 'recording' && (
            <MeteringBar metering={recorderState.metering} />
          )}
        </View>

        {/* ─ Zone transcrite ─ */}
        {(phase === 'review' || phase === 'reformulating') && transcribed !== '' && (
          <>
            <View style={styles.arrowRow}>
              <View style={[styles.arrowLine, { backgroundColor: theme.border }]} />
              <View style={[styles.arrowCircle, { backgroundColor: '#4A90D9' }]}>
                <Ionicons name="text" size={14} color="#FFFFFF" />
              </View>
              <View style={[styles.arrowLine, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={16} color={theme.text} />
                <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('voice.transcribedText')}</Text>
              </View>

              <View style={styles.transcriptZone}>
                <TextInput
                  style={styles.transcriptInput}
                  value={transcribed}
                  onChangeText={setTranscribed}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={phase === 'review'}
                  placeholder={t('voice.noText')}
                  placeholderTextColor="#A0AEC0"
                  accessibilityLabel={t('voice.transcribedText')}
                />
              </View>
            </View>
          </>
        )}

        {/* ─ Zone reformulée CNV ─ */}
        {reformulated !== '' && (
          <>
            <View style={styles.arrowRow}>
              <View style={[styles.arrowLine, { backgroundColor: theme.border }]} />
              <View style={[styles.arrowCircle, { backgroundColor: theme.accent }]}>
                {phase === 'reformulating' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                )}
              </View>
              <View style={[styles.arrowLine, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={11} color="#276749" />
                  <Text style={styles.aiBadgeText}>{t('voice.aiCnvBadge')}</Text>
                </View>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('voice.reformulatedMessage')}</Text>
              </View>

              <View style={styles.reformulatedZone}>
                {phase === 'reformulating' ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#276749" />
                    <Text style={styles.loadingText}>{t('voice.reformulating')}</Text>
                  </View>
                ) : (
                  <Text style={styles.reformulatedText}>{reformulated}</Text>
                )}
              </View>
            </View>
          </>
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
      {phase === 'review' && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>

          {/* Grille de boutons */}
          <View style={styles.reviewActions}>

            {/* Recommencer */}
            <TouchableOpacity
              style={[styles.actionBtnGhost, { borderColor: theme.border }]}
              onPress={() => {
                setPhase('idle');
                setTranscribed('');
                setReformulated('');
                setError(null);
              }}
              accessibilityLabel={t('voice.restart')}
            >
              <Ionicons name="refresh" size={16} color={theme.textSecondary} />
              <Text style={[styles.actionBtnGhostText, { color: theme.textSecondary }]}>{t('voice.restart')}</Text>
            </TouchableOpacity>

            {/* Reformuler CNV */}
            {!reformulated && (
              <TouchableOpacity
                style={[styles.actionBtnPrimary, { backgroundColor: theme.primary }]}
                onPress={handleReformulate}
                disabled={!transcribed.trim()}
                accessibilityLabel={t('voice.reformulate')}
              >
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnPrimaryText}>{t('voice.reformulateBtn')}</Text>
              </TouchableOpacity>
            )}

            {/* Envoyer */}
            <TouchableOpacity
              style={[
                styles.actionBtnSend,
                { backgroundColor: !familyId ? '#A0AEC0' : '#276749' },
              ]}
              onPress={handleSend}
              disabled={!familyId || sending}
              accessibilityLabel={t('voice.send')}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnSendText}>{t('voice.sendBtn')}</Text>
                </>
              )}
            </TouchableOpacity>

          </View>
        </View>
      )}
    </View>
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
  sectionLabel:  { fontSize: 14, fontWeight: '700' },

  // ── Bouton d'enregistrement
  recordButtonArea: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 24, gap: 16,
  },
  recordButton: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#E53E3E',
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#E53E3E', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  recordButtonActive: {
    backgroundColor: '#C53030',
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.6,
  },
  timerText: {
    fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'],
    color: '#E53E3E',
  },
  hintText: { fontSize: 13, textAlign: 'center' },

  // ── Flèche de transition
  arrowRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  arrowLine:   { flex: 1, height: 1 },
  arrowCircle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Zone transcrite
  transcriptZone: {
    backgroundColor: '#EBF8FF',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#90CDF4',
    padding: 14,
  },
  transcriptInput: {
    fontSize: 16, color: '#2A4365', lineHeight: 24,
    minHeight: 100,
  },

  // ── Zone reformulée (vert pâle)
  reformulatedZone: {
    backgroundColor: '#EAF3DE',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#9AE6B4',
    padding: 14,
  },
  reformulatedText: {
    fontSize: 16, color: '#276749', lineHeight: 24,
  },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 80, justifyContent: 'center',
  },
  loadingText: { fontSize: 14, color: '#276749', fontWeight: '600' },

  // ── Badge IA
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EDF7F3', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  aiBadgeText: { fontSize: 11, color: '#276749', fontWeight: '800' },

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
  reviewActions: { flexDirection: 'row', gap: 10 },
  actionBtnGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: 10, paddingVertical: 12, borderWidth: 1.5,
  },
  actionBtnGhostText: { fontSize: 13, fontWeight: '600' },
  actionBtnPrimary: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, paddingVertical: 12,
  },
  actionBtnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  actionBtnSend: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, paddingVertical: 12,
  },
  actionBtnSendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
