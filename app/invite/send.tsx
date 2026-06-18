import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SMS   from 'expo-sms';
import * as Mail  from 'expo-mail-composer';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import InviteCodeDisplay from '../../components/invite/InviteCodeDisplay';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

import { API_BASE } from '../constants/api';
const POLL_INTERVAL_MS = 5000;

interface InvitationData {
  invitationId: string;
  code: string;
  link: string;
  deepLink: string;
  qrData: string;
  codeExpiresAt: string;
  linkExpiresAt: string;
}

interface InvitationStatus {
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  acceptedByName?: string | null;
}

async function createInvitation(token: string): Promise<InvitationData> {
  const res = await fetch(`${API_BASE}/api/invitations/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchStatus(token: string): Promise<InvitationStatus> {
  const res = await fetch(`${API_BASE}/api/invitations/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function SendInviteScreen() {
  const router = useRouter();
  const { token: authToken } = useAuth();
  const { t } = useTranslation();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [statusMsg,  setStatusMsg]  = useState<string>(t('invite.waitingForCoparent'));

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Générer / regénérer l'invitation ───────────────────────
  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await createInvitation(authToken);
      setInvitation(data);
    } catch (e: any) {
      setError(e.message ?? t('invite.networkError'));
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) generate();
  }, [authToken]);

  // ── Polling statut ──────────────────────────────────────────
  useEffect(() => {
    if (!invitation || !authToken) return;

    pollRef.current = setInterval(async () => {
      try {
        const { status, acceptedByName } = await fetchStatus(authToken);
        if (status === 'accepted') {
          clearInterval(pollRef.current!);
          setStatusMsg(
            t('invite.coparentJoined', { name: acceptedByName ?? t('invite.yourCoparent') })
          );
          setTimeout(() => router.replace('/invite/children'), 1500);
        } else if (status === 'expired') {
          clearInterval(pollRef.current!);
          setStatusMsg(t('invite.invitationExpired'));
        }
      } catch { /* silencieux */ }
    }, POLL_INTERVAL_MS);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [invitation]);

  // ── Partage ─────────────────────────────────────────────────
  async function shareSMS() {
    const available = await SMS.isAvailableAsync();
    if (!available) { alert(t('invite.smsNotAvailable')); return; }
    await SMS.sendSMSAsync([], buildShareMessage());
  }

  async function shareEmail() {
    const available = await Mail.isAvailableAsync();
    if (!available) { alert(t('invite.emailNotAvailable')); return; }
    await Mail.composeAsync({
      subject: t('invite.emailSubject'),
      body: buildShareMessage(),
    });
  }

  async function copyLink() {
    if (!invitation) return;
    await Clipboard.setStringAsync(invitation.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function buildShareMessage(): string {
    if (!invitation) return '';
    return t('invite.shareMessage', { code: invitation.code, link: invitation.link });
  }

  // ── Rendu ───────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={generate}>
          <Text style={styles.primaryBtnText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─ Section 1 : code ─ */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('invite.codeTitle')}</Text>
        <Text style={styles.sectionSub}>
          {t('invite.codeSubtitle')}
        </Text>
        <InviteCodeDisplay
          code={invitation?.code ?? null}
          onRefresh={generate}
          loading={loading}
          expiresLabel={
            invitation
              ? t('invite.expiresAt', {
                  date: new Date(invitation.codeExpiresAt).toLocaleString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })
                })
              : undefined
          }
        />
      </View>

      {/* ─ Section 2 : boutons de partage ─ */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('invite.shareTitle')}</Text>
        <View style={styles.shareRow}>
          <ShareButton icon="✉️" label={t('invite.sms')}   onPress={shareSMS}  />
          <ShareButton icon="📧" label={t('invite.email')} onPress={shareEmail} />
          <ShareButton
            icon={copied ? '✅' : '🔗'}
            label={copied ? t('invite.copied') : t('invite.copy')}
            onPress={copyLink}
          />
        </View>
      </View>

      {/* ─ Section 3 : QR code ─ */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('invite.qrTitle')}</Text>
        <Text style={styles.sectionSub}>
          {t('invite.qrSubtitle')}
        </Text>
        <View style={styles.qrWrapper}>
          {invitation ? (
            <QRCode
              value={invitation.qrData}
              size={180}
              color="#1A3A5C"
              backgroundColor="#FFFFFF"
            />
          ) : (
            <ActivityIndicator color="#1A3A5C" />
          )}
        </View>
      </View>

      {/* ─ Section 4 : bannière statut ─ */}
      <View style={styles.statusBanner}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{statusMsg}</Text>
      </View>
    </ScrollView>
  );
}

// ── Sous-composant bouton de partage ──────────────────────────

function ShareButton({
  icon, label, onPress,
}: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.shareBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.shareBtnIcon}>{icon}</Text>
      <Text style={styles.shareBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3A5C',
  },
  sectionSub: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 18,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  shareBtn: {
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F0F4F8',
    width: 88,
  },
  shareBtnIcon: {
    fontSize: 24,
  },
  shareBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A3A5C',
  },
  qrWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#63B3ED',
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#2B6CB0',
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#E53E3E',
    textAlign: 'center',
    fontSize: 14,
  },
});
