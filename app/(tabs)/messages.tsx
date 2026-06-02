import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter }            from 'expo-router';
import { Ionicons }             from '@expo/vector-icons';
import { useSafeAreaInsets }    from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../hooks/useAuth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────

interface Message {
  id:                  string;
  sender_id:           string;
  content:             string;
  original_content:    string | null;
  is_reformulated:     boolean;
  aggressiveness_score: string | null;
  read_at:             string | null;
  created_at:          string;
  sender_first_name:   string;
  sender_parent_type:  string | null;
}

// ─── Utilitaires ──────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7)  return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function parentEmoji(type: string | null): string {
  switch (type) {
    case 'papa':       return '👨';
    case 'maman':      return '👩';
    case 'beau-pere':  return '👨‍👧';
    case 'belle-mere': return '👩‍👧';
    default:           return '👤';
  }
}

// ─── Bulle de message ─────────────────────────────────────────

interface BubbleProps {
  msg:      Message;
  isMine:   boolean;
  theme:    ReturnType<typeof useTheme>['theme'];
}

function MessageBubble({ msg, isMine, theme }: BubbleProps) {
  const [expanded, setExpanded] = useState(false);

  const bubbleBg = isMine
    ? theme.primary
    : theme.surface;

  const textColor = isMine ? '#FFFFFF' : theme.text;

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>

      {/* Avatar (coparent uniquement) */}
      {!isMine && (
        <View style={[styles.avatar, { backgroundColor: theme.surfaceAlt }]}>
          <Text style={styles.avatarEmoji}>
            {parentEmoji(msg.sender_parent_type)}
          </Text>
        </View>
      )}

      <View style={[styles.bubbleCol, isMine ? styles.bubbleColRight : styles.bubbleColLeft]}>

        {/* Badge "Reformulé par IA" */}
        {msg.is_reformulated && (
          <View style={[styles.aiBadge, isMine ? styles.aiBadgeRight : styles.aiBadgeLeft]}>
            <Ionicons name="sparkles" size={10} color="#276749" />
            <Text style={styles.aiBadgeText}>Reformulé par IA</Text>
          </View>
        )}

        {/* Bulle principale */}
        <TouchableOpacity
          activeOpacity={msg.original_content ? 0.7 : 1}
          onPress={() => msg.original_content && setExpanded((e) => !e)}
          style={[
            styles.bubble,
            { backgroundColor: bubbleBg, borderColor: isMine ? 'transparent' : theme.border },
            !isMine && styles.bubbleBorder,
            msg.is_reformulated && !isMine && styles.bubbleReformulated,
          ]}
        >
          <Text style={[styles.bubbleText, { color: textColor }]}>
            {msg.content}
          </Text>
        </TouchableOpacity>

        {/* Message original (dépliable) */}
        {expanded && msg.original_content && (
          <View style={styles.originalBox}>
            <Text style={styles.originalLabel}>Message original :</Text>
            <Text style={styles.originalText}>{msg.original_content}</Text>
          </View>
        )}

        {/* Horodatage + lu */}
        <View style={[styles.meta, isMine && styles.metaRight]}>
          <Text style={[styles.metaTime, { color: theme.textSecondary }]}>
            {formatTime(msg.created_at)}
          </Text>
          {isMine && (
            <Ionicons
              name={msg.read_at ? 'checkmark-done' : 'checkmark'}
              size={12}
              color={msg.read_at ? theme.accent : theme.textSecondary}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Séparateur de date ───────────────────────────────────────

function DateSeparator({ date, theme }: { date: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  const label = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return (
    <View style={styles.dateSep}>
      <View style={[styles.dateSepLine, { backgroundColor: theme.border }]} />
      <Text style={[styles.dateSepText, { color: theme.textSecondary, backgroundColor: theme.background }]}>
        {label}
      </Text>
      <View style={[styles.dateSepLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

// ─── Écran messages ───────────────────────────────────────────

export default function MessagesScreen() {
  const router            = useRouter();
  const insets            = useSafeAreaInsets();
  const { theme }         = useTheme();
  const { user, token }   = useAuth();

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [familyId,   setFamilyId]   = useState<string | null>(null);
  const [coparent,   setCoparent]   = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ── Charger la famille puis les messages ──────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      // 1. Récupérer l'ID famille
      let fid = familyId;
      if (!fid) {
        const famRes = await fetch(`${API_BASE}/api/families/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (famRes.ok) {
          const famData = await famRes.json();
          fid = famData.family?.id ?? null;
          if (fid) {
            setFamilyId(fid);
            // Récupérer le prénom du coparent
            const f = famData.family;
            const otherName = f.parent_a_id === user?.id
              ? famData.parentB?.first_name ?? null
              : famData.parentA?.first_name ?? null;
            setCoparent(otherName);
          }
        }
      }

      if (!fid) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 2. Charger les messages
      const msgRes = await fetch(`${API_BASE}/api/messages/${fid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        setMessages(msgData.messages ?? []);
      }
    } catch {
      if (!silent) setError('Impossible de charger les messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, familyId]);

  useEffect(() => { loadData(); }, []);

  // Auto-scroll au dernier message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  // ── Grouper par jour ──────────────────────────────────────
  type ListItem = Message | { type: 'date-separator'; date: string; id: string };

  const listItems: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const day = msg.created_at.slice(0, 10);
    if (day !== lastDate) {
      listItems.push({ type: 'date-separator', date: msg.created_at, id: `sep-${day}` });
      lastDate = day;
    }
    listItems.push(msg);
  }

  // ── Rendu ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const noFamily = !familyId;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ─ Header ─ */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>{coparent ?? 'Messages'}</Text>
          {messages.filter((m) => !m.read_at && m.sender_id !== user?.id).length > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {messages.filter((m) => !m.read_at && m.sender_id !== user?.id).length}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.composeBtn, { borderColor: 'rgba(255,255,255,0.4)' }]}
          onPress={() => router.push('/messages/compose')}
          disabled={noFamily}
          accessibilityLabel="Nouveau message"
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ─ Pas de famille ─ */}
      {noFamily && !error && (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>👨‍👩‍👧</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Pas encore de famille liée
          </Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Invitez votre coparent pour commencer à échanger des messages.
          </Text>
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/invite/send')}
          >
            <Text style={styles.inviteBtnText}>Inviter mon coparent</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─ Erreur ─ */}
      {error && (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: theme.border }]}
            onPress={() => loadData()}
          >
            <Text style={[styles.retryBtnText, { color: theme.primary }]}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─ Liste messages ─ */}
      {familyId && !error && (
        <>
          {messages.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ fontSize: 52 }}>💬</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Commencez à échanger
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Vos messages sont reformulés par l'IA{'\n'}pour une communication apaisée.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={listItems}
              keyExtractor={(item) => ('id' in item ? item.id : item.id)}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); loadData(true); }}
                  tintColor={theme.primary}
                />
              }
              renderItem={({ item }) => {
                if ('type' in item && item.type === 'date-separator') {
                  return <DateSeparator date={item.date} theme={theme} />;
                }
                const msg = item as Message;
                return (
                  <MessageBubble
                    msg={msg}
                    isMine={msg.sender_id === user?.id}
                    theme={theme}
                  />
                );
              }}
            />
          )}

          {/* ─ Bouton composer (FAB) ─ */}
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 20 }]}
            onPress={() => router.push('/messages/compose')}
            accessibilityLabel="Nouveau message"
            accessibilityRole="button"
          >
            <Ionicons name="create" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },

  // ── Header
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle:      { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  headerBadge: {
    backgroundColor: '#E53E3E', borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  headerBadgeText:  { color: '#FFF', fontSize: 11, fontWeight: '800' },
  composeBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },

  // ── Liste
  list: { padding: 16, gap: 4 },

  // ── Séparateur date
  dateSep:      { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dateSepLine:  { flex: 1, height: 1 },
  dateSepText:  { fontSize: 11, fontWeight: '600', paddingHorizontal: 8 },

  // ── Bulle
  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 3 },
  bubbleRowLeft:  { alignSelf: 'flex-start', maxWidth: '82%' },
  bubbleRowRight: { alignSelf: 'flex-end',   maxWidth: '82%', flexDirection: 'row-reverse' },
  bubbleCol:      { flex: 1 },
  bubbleColLeft:  { alignItems: 'flex-start' },
  bubbleColRight: { alignItems: 'flex-end' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 18 },
  bubble: {
    borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  bubbleBorder:       { borderWidth: 1 },
  bubbleReformulated: { borderColor: '#1D9E75' },
  bubbleText:         { fontSize: 15, lineHeight: 22 },

  // ── Badge IA
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EDF7F3', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 3,
  },
  aiBadgeLeft:  { alignSelf: 'flex-start' },
  aiBadgeRight: { alignSelf: 'flex-end' },
  aiBadgeText:  { fontSize: 10, color: '#276749', fontWeight: '700' },

  // ── Message original
  originalBox: {
    backgroundColor: '#FFF5F5', borderRadius: 10, padding: 10,
    marginTop: 4, borderWidth: 1, borderColor: '#FEB2B2',
  },
  originalLabel: { fontSize: 11, color: '#8C4A3A', fontWeight: '700', marginBottom: 2 },
  originalText:  { fontSize: 13, color: '#8C4A3A', lineHeight: 18 },

  // ── Meta
  meta:      { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaRight: { alignSelf: 'flex-end' },
  metaTime:  { fontSize: 11 },

  // ── État vide
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody:  { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  inviteBtn: {
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8,
  },
  inviteBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  retryBtn: {
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24,
    borderWidth: 1.5, marginTop: 8,
  },
  retryBtnText: { fontWeight: '700', fontSize: 15 },

  // ── FAB
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
