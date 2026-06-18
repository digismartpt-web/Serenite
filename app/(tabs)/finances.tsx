import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Pressable, Image,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker      from 'expo-image-picker';
import * as FileSystem       from 'expo-file-system/legacy';
import * as Sharing          from 'expo-sharing';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../hooks/useAuth';
import { useTranslation, tList } from '../../i18n/useTranslation';
import { type LangCode, shortMonths } from '../../i18n/translations';

import { API_BASE } from '../constants/api';

// ─── Types ────────────────────────────────────────────────────

type Category =
  | 'garde' | 'activite' | 'sante' | 'scolarite'
  | 'vetement' | 'alimentation' | 'loisir' | 'autre';

interface Expense {
  id:              string;
  title:           string;
  amount:          string;
  category:        Category;
  expense_date:    string;
  split_ratio:     string;
  notes:           string | null;
  paid_by:         string;
  payer_first_name: string;
}

interface Balance {
  net:      number;
  iOwe:     number;
  theyOwe:  number;
}

interface VaultDoc {
  id:        string;
  title:     string;
  category:  string;
  file_url:  string;
  created_at: string;
}

interface HealthRecord {
  id:          string;
  child_id:    string;
  child_name?: string;
  type:        string;
  title:       string;
  description: string;
  record_date: string;
  doctor:      string | null;
}

interface Child {
  id:         string;
  first_name: string;
}

// ─── Config catégories ────────────────────────────────────────

const CATEGORIES: Record<Category, { label: string; emoji: string; color: string }> = {
  garde:        { label: 'Garde',        emoji: '🏠', color: '#1A3A5C' },
  activite:     { label: 'Activité',     emoji: '⚽', color: '#276749' },
  sante:        { label: 'Santé',        emoji: '🏥', color: '#8C2B1E' },
  scolarite:    { label: 'Scolarité',    emoji: '📚', color: '#4A3580' },
  vetement:     { label: 'Vêtements',    emoji: '👕', color: '#0D5060' },
  alimentation: { label: 'Alimentation', emoji: '🛒', color: '#7A4F00' },
  loisir:       { label: 'Loisirs',      emoji: '🎨', color: '#7A1F4C' },
  autre:        { label: 'Autre',        emoji: '📌', color: '#5A7499' },
};

const VAULT_CATEGORIES = [
  'jugement', 'ordonnance', 'convention', 'scolaire', 'médical',
  'administratif', 'financier', 'autre',
] as const;

const HEALTH_TYPES: Record<string, { label: string; emoji: string; color: string }> = {
  vaccin:       { label: 'Vaccin',       emoji: '💉', color: '#38A169' },
  traitement:   { label: 'Traitement',   emoji: '💊', color: '#D69E2E' },
  consultation: { label: 'Consultation', emoji: '🩺', color: '#3182CE' },
  examen:       { label: 'Examen',       emoji: '🔬', color: '#805AD5' },
  allergie:     { label: 'Allergie',     emoji: '⚠️', color: '#E53E3E' },
  autre:        { label: 'Autre',        emoji: '📌', color: '#718096' },
};

function formatAmount(n: string | number): string {
  return parseFloat(String(n)).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Carte bilan ──────────────────────────────────────────────

function BalanceCard({
  balance, theme, coparentName, t,
}: {
  balance: Balance;
  theme:   ReturnType<typeof useTheme>['theme'];
  coparentName: string | null;
  t:       (key: string, vars?: Record<string, string | number>) => string;
}) {
  const balanced = balance.iOwe < 0.01 && balance.theyOwe < 0.01;

  return (
    <View style={[
      balStyles.card,
      {
        backgroundColor: balanced ? '#EDF7F3' : balance.iOwe > 0 ? '#FFF5F5' : '#EDF7F3',
        borderColor:     balanced ? '#1D9E75' : balance.iOwe > 0 ? '#FEB2B2' : '#1D9E75',
      },
    ]}>
      <View style={balStyles.row}>
        <Text style={{ fontSize: 32 }}>
          {balanced ? '✅' : balance.iOwe > 0 ? '📤' : '📥'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[balStyles.label, { color: balanced ? '#276749' : balance.iOwe > 0 ? '#8C2B1E' : '#276749' }]}>
            {balanced
              ? t('finances.balanced')
              : balance.iOwe > 0
                ? t('finances.youOwe', { name: coparentName ?? t('finances.you') })
                : t('finances.theyOwe', { name: coparentName ?? t('finances.you') })}
          </Text>
          {!balanced && (
            <Text style={[balStyles.amount, { color: balance.iOwe > 0 ? '#8C2B1E' : '#276749' }]}>
              {formatAmount(balance.iOwe > 0 ? balance.iOwe : balance.theyOwe)}
            </Text>
          )}
          {balanced && (
            <Text style={[balStyles.subLabel, { color: '#276749' }]}>
              {t('finances.sharedEqually')}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const balStyles = StyleSheet.create({
  card: {
    borderRadius: 14, borderWidth: 1.5, padding: 16, marginHorizontal: 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label:    { fontSize: 14, fontWeight: '700' },
  amount:   { fontSize: 26, fontWeight: '800', marginTop: 4 },
  subLabel: { fontSize: 12, marginTop: 2 },
});

// ─── Formulaire ajout dépense ─────────────────────────────────

interface AddExpenseFormProps {
  familyId: string;
  token:    string;
  onSaved:  () => void;
  onClose:  () => void;
  theme:    ReturnType<typeof useTheme>['theme'];
  t:        (key: string, vars?: Record<string, string | number>) => string;
  lang:     LangCode;
}

function AddExpenseForm({ familyId, token, onSaved, onClose, theme, t, lang }: AddExpenseFormProps) {
  const [title,      setTitle]      = useState('');
  const [amount,     setAmount]     = useState('');
  const [category,   setCategory]   = useState<Category>('autre');
  const [split,      setSplit]      = useState(50); // percentage
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);

  const catLabels = tList('finances.categories', lang);

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadPhoto(result.assets[0].uri);
  }

  async function handleTakePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadPhoto(result.assets[0].uri);
  }

  async function uploadPhoto(uri: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri, type: 'image/jpeg', name: 'receipt.jpg' } as any);
      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { setError("Erreur lors de l'upload"); return; }
      const { url } = await res.json();
      setReceiptUrl(url);
    } catch {
      setError("Erreur réseau lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!title.trim())   { setError(t('finances.titleRequired')); return; }
    if (isNaN(amt) || amt <= 0) { setError(t('finances.invalidAmount')); return; }
    setLoading(true); setError(null);
    try {
      const body: Record<string, any> = {
        familyId,
        title:      title.trim(),
        amount:     amt,
        category,
        splitRatio: split / 100,
      };
      if (receiptUrl) body.receiptUrl = receiptUrl;

      const res = await fetch(`${API_BASE}/api/expenses`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? t('error')); return; }
      onSaved();
    } catch { setError(t('networkError')); }
    finally { setLoading(false); }
  }

  const splits = [25, 33, 50, 67, 75, 100];

  function handlePhotoPress() {
    if (receiptUrl) {
      // Ouvrir l'image en plein écran — on pourrait ajouter un modal ici
      return;
    }
    // Proposer les deux options
    handlePickPhoto();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[expFormStyles.sheet, { backgroundColor: theme.surface }]}>

        <View style={expFormStyles.handle} />

        <View style={expFormStyles.header}>
          <Text style={[expFormStyles.title, { color: theme.text }]}>{t('finances.newExpense')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={expFormStyles.body} keyboardShouldPersistTaps="handled">

          {/* Titre */}
          <TextInput
            style={[expFormStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder={t('finances.expenseName')}
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          {/* Montant */}
          <View style={expFormStyles.amountRow}>
            <TextInput
              style={[expFormStyles.amountInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder={t('finances.amount')}
              placeholderTextColor={theme.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <View style={[expFormStyles.currencyBadge, { backgroundColor: theme.primary }]}>
              <Text style={expFormStyles.currencyText}>{t('finances.currency')}</Text>
            </View>
          </View>

          {/* Photo justificatif */}
          <Text style={[expFormStyles.label, { color: theme.textSecondary }]}>Justificatif</Text>
          <View style={expFormStyles.receiptRow}>
            {!receiptUrl ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[expFormStyles.photoBtn, { borderColor: theme.border }]}
                  onPress={handlePickPhoto}
                  disabled={uploading}
                >
                  <Ionicons name="images-outline" size={18} color={theme.primary} />
                  <Text style={[expFormStyles.photoBtnText, { color: theme.primary }]}>
                    {uploading ? 'Upload...' : '📷 Ajouter une photo'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[expFormStyles.photoBtnSmall, { borderColor: theme.border }]}
                  onPress={handleTakePhoto}
                  disabled={uploading}
                >
                  <Ionicons name="camera-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePhotoPress} style={expFormStyles.thumbnailContainer}>
                <Image source={{ uri: receiptUrl }} style={expFormStyles.thumbnail} />
                <TouchableOpacity
                  style={expFormStyles.removePhotoBtn}
                  onPress={() => setReceiptUrl(null)}
                >
                  <Ionicons name="close-circle" size={20} color="#E53E3E" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          </View>

          {/* Catégorie */}
          <Text style={[expFormStyles.label, { color: theme.textSecondary }]}>Catégorie</Text>
          <View style={expFormStyles.catGrid}>
            {(Object.keys(CATEGORIES) as Category[]).map((cat, idx) => (
              <TouchableOpacity
                key={cat}
                style={[
                  expFormStyles.catChip,
                  { borderColor: CATEGORIES[cat].color },
                  category === cat && { backgroundColor: CATEGORIES[cat].color },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text style={{ fontSize: 16 }}>{CATEGORIES[cat].emoji}</Text>
                <Text style={[expFormStyles.catLabel, { color: category === cat ? '#FFF' : CATEGORIES[cat].color }]}>
                  {catLabels[idx] ?? CATEGORIES[cat].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Répartition */}
          <Text style={[expFormStyles.label, { color: theme.textSecondary }]}>
            {t('finances.mySplit', { s: split, r: 100 - split })}
          </Text>
          <View style={expFormStyles.splitRow}>
            {splits.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  expFormStyles.splitChip,
                  { borderColor: theme.border },
                  split === s && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setSplit(s)}
              >
                <Text style={[expFormStyles.splitLabel, { color: split === s ? '#FFF' : theme.text }]}>
                  {s}/{100 - s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <View style={expFormStyles.errorBanner}>
              <Ionicons name="warning-outline" size={14} color="#C53030" />
              <Text style={expFormStyles.errorText}>{error}</Text>
            </View>
          )}

        </ScrollView>

        <TouchableOpacity
          style={[expFormStyles.saveBtn, { backgroundColor: loading ? theme.textSecondary : '#276749' }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Ionicons name="checkmark" size={18} color="#FFF" />
              <Text style={expFormStyles.saveBtnText}>{t('save')}</Text>
            </>
          )}
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const expFormStyles = StyleSheet.create({
  sheet:      { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E0', alignSelf: 'center', marginBottom: 12 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  title:      { fontSize: 18, fontWeight: '800' },
  body:       { padding: 20, gap: 0 },
  label:      { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, marginBottom: 16,
  },
  amountRow:  { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'center' },
  amountInput: {
    flex: 1, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 24, fontWeight: '700', textAlign: 'right',
  },
  currencyBadge: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  currencyText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  receiptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  photoBtnText: { fontSize: 13, fontWeight: '600' },
  photoBtnSmall: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  thumbnailContainer: { position: 'relative', alignSelf: 'flex-start' },
  thumbnail: { width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' },
  removePhotoBtn: { position: 'absolute', top: -6, right: -6 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  catLabel: { fontSize: 12, fontWeight: '700' },
  splitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  splitChip: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  splitLabel: { fontSize: 13, fontWeight: '700' },
  errorBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 8, padding: 10 },
  errorText:   { color: '#C53030', fontSize: 13, flex: 1 },
  saveBtn: {
    margin: 20, borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

// ─── Sections pliables ────────────────────────────────────────

function CollapsibleSection({
  title, expanded, onToggle, children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      <TouchableOpacity
        style={sectionStyles.header}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[sectionStyles.headerTitle, { color: theme.text }]}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textSecondary}
        />
      </TouchableOpacity>
      {expanded && <View style={{ marginTop: 8 }}>{children}</View>}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: '800' },
});

// ─── Section Coffre-fort documentaire ─────────────────────────

function VaultSection({
  token, t,
}: {
  token: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [docs,       setDocs]       = useState<VaultDoc[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const { theme } = useTheme();

  const loadDocs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/vault`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setDocs(d.documents ?? d ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (expanded) loadDocs(); }, [expanded, loadDocs]);

  async function handleDelete(id: string) {
    try {
      await fetch(`${API_BASE}/api/vault/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {}
  }

  const categoryEmoji = (cat: string) => {
    const map: Record<string, string> = {
      jugement: '⚖️', ordonnance: '📋', convention: '🤝', scolaire: '📚',
      médical: '🏥', administratif: '📁', financier: '💰', autre: '📌',
    };
    return map[cat.toLowerCase()] ?? '📄';
  };

  return (
    <>
      <CollapsibleSection
        title="🔒 Coffre-fort documentaire"
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : docs.length === 0 ? (
          <View style={[emptyStyles.container, { borderColor: theme.border }]}>
            <Text style={{ fontSize: 32 }}>📁</Text>
            <Text style={[emptyStyles.text, { color: theme.textSecondary }]}>
              Aucun document dans le coffre
            </Text>
          </View>
        ) : (
          docs.map((doc) => (
            <View
              key={doc.id}
              style={[itemStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={{ fontSize: 22 }}>{categoryEmoji(doc.category)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[itemStyles.title, { color: theme.text }]}>{doc.title}</Text>
                <Text style={[itemStyles.meta, { color: theme.textSecondary }]}>
                  {doc.category} · {formatFullDate(doc.created_at)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(doc.id)}>
                <Ionicons name="trash-outline" size={18} color={theme.danger ?? '#E53E3E'} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[addBtnStyles.btn, { backgroundColor: theme.primary }]}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={addBtnStyles.text}>{t('finances.add') ?? '+ Ajouter'}</Text>
        </TouchableOpacity>
      </CollapsibleSection>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <AddVaultModal
          token={token}
          onSaved={() => { setShowModal(false); loadDocs(); }}
          onClose={() => setShowModal(false)}
          theme={theme}
        />
      </Modal>
    </>
  );
}

// ─── Modal ajout document coffre ──────────────────────────────

function AddVaultModal({
  token, onSaved, onClose, theme,
}: {
  token: string;
  onSaved: () => void;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const [title,       setTitle]       = useState('');
  const [category,    setCategory]    = useState<string>('jugement');
  const [fileUri,     setFileUri]     = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fileUrl,     setFileUrl]     = useState<string | null>(null);

  async function handlePickFile() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setFileUri(uri);
    await uploadFile(uri);
  }

  async function uploadFile(uri: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri, type: 'image/jpeg', name: 'document.jpg' } as any);
      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { setError("Erreur lors de l'upload"); return; }
      const data = await res.json();
      setFileUrl(data.url);
    } catch {
      setError("Erreur réseau lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) { setError('Titre requis'); return; }
    if (!fileUrl) { setError('Fichier requis'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/vault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), category, file_url: fileUrl }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); return; }
      onSaved();
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  }

  return (
    <View style={[modalStyles.container, { backgroundColor: theme.background }]}>
      <View style={modalStyles.header}>
        <Text style={[modalStyles.title, { color: theme.text }]}>Ajouter un document</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={modalStyles.body}>
        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Titre</Text>
        <TextInput
          style={[modalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="Titre du document"
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Catégorie</Text>
        <View style={modalStyles.grid}>
          {VAULT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                modalStyles.chip,
                { borderColor: theme.border },
                category === cat && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[
                modalStyles.chipText,
                { color: category === cat ? '#FFF' : theme.text },
              ]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Fichier</Text>
        {fileUri ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Image source={{ uri: fileUri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
            <Text style={[modalStyles.hint, { color: theme.textSecondary }]}>Fichier ajouté ✓</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[modalStyles.uploadBtn, { borderColor: theme.border }]}
            onPress={handlePickFile}
            disabled={uploading}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={theme.primary} />
            <Text style={[modalStyles.uploadText, { color: theme.primary }]}>
              {uploading ? 'Upload en cours...' : 'Sélectionner un fichier'}
            </Text>
          </TouchableOpacity>
        )}

        {error && (
          <View style={modalStyles.errorBanner}>
            <Text style={modalStyles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
      <TouchableOpacity
        style={[modalStyles.saveBtn, { backgroundColor: loading ? theme.textSecondary : '#276749' }]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : (
          <Text style={modalStyles.saveBtnText}>Enregistrer</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Section Carnet de santé ──────────────────────────────────

function HealthSection({
  token, t,
}: {
  token: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [records,      setRecords]      = useState<HealthRecord[]>([]);
  const [children,     setChildren]     = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [expanded,     setExpanded]     = useState(false);
  const { theme } = useTheme();

  const loadChildren = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/children`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setChildren(d.children ?? d ?? []);
      }
    } catch {}
  }, [token]);

  const loadRecords = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = selectedChild
        ? `${API_BASE}/api/health/child/${selectedChild}`
        : `${API_BASE}/api/health`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setRecords(d.records ?? d ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token, selectedChild]);

  useEffect(() => { if (expanded) { loadChildren(); loadRecords(); } }, [expanded, loadChildren, loadRecords]);

  async function handleDelete(id: string) {
    try {
      await fetch(`${API_BASE}/api/health/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  }

  const getHealthType = (type: string) => {
    const t = type.toLowerCase();
    return HEALTH_TYPES[t] ?? HEALTH_TYPES.autre;
  };

  const selectedChildName = children.find((c) => c.id === selectedChild)?.first_name ?? 'Tous les enfants';

  return (
    <>
      <CollapsibleSection
        title="🏥 Carnet de santé"
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      >
        {children.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <TouchableOpacity
              style={[
                childChipStyles.chip,
                { borderColor: theme.border },
                !selectedChild && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setSelectedChild(null)}
            >
              <Text style={[
                childChipStyles.text,
                { color: !selectedChild ? '#FFF' : theme.text },
              ]}>Tous</Text>
            </TouchableOpacity>
            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={[
                  childChipStyles.chip,
                  { borderColor: theme.border },
                  selectedChild === child.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setSelectedChild(child.id)}
              >
                <Text style={[
                  childChipStyles.text,
                  { color: selectedChild === child.id ? '#FFF' : theme.text },
                ]}>{child.first_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : records.length === 0 ? (
          <View style={[emptyStyles.container, { borderColor: theme.border }]}>
            <Text style={{ fontSize: 32 }}>🩺</Text>
            <Text style={[emptyStyles.text, { color: theme.textSecondary }]}>
              Aucun enregistrement de santé
            </Text>
          </View>
        ) : (
          records.map((rec) => {
            const ht = getHealthType(rec.type);
            return (
              <View
                key={rec.id}
                style={[itemStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[itemStyles.badge, { backgroundColor: ht.color + '20' }]}>
                  <Text style={{ fontSize: 18 }}>{ht.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[itemStyles.title, { color: theme.text }]}>{rec.title}</Text>
                  <Text style={[itemStyles.meta, { color: theme.textSecondary }]}>
                    {formatFullDate(rec.record_date)}
                    {rec.doctor ? ` · Dr. ${rec.doctor}` : ''}
                    {rec.child_name ? ` · ${rec.child_name}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(rec.id)}>
                  <Ionicons name="trash-outline" size={18} color={theme.danger ?? '#E53E3E'} />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={[addBtnStyles.btn, { backgroundColor: theme.primary }]}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={addBtnStyles.text}>{t('finances.add') ?? '+ Ajouter'}</Text>
        </TouchableOpacity>
      </CollapsibleSection>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <AddHealthModal
          token={token}
          childrenList={children}
          selectedChild={selectedChild}
          onSaved={() => { setShowModal(false); loadRecords(); }}
          onClose={() => setShowModal(false)}
          theme={theme}
        />
      </Modal>
    </>
  );
}

// ─── Modal ajout santé ────────────────────────────────────────

function AddHealthModal({
  token, childrenList, selectedChild, onSaved, onClose, theme,
}: {
  token: string;
  childrenList: Child[];
  selectedChild: string | null;
  onSaved: () => void;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const [type,         setType]         = useState('vaccin');
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [recordDate,   setRecordDate]   = useState(new Date().toISOString().split('T')[0]);
  const [doctor,       setDoctor]       = useState('');
  const [childId,      setChildId]      = useState(selectedChild ?? '');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) { setError('Titre requis'); return; }
    if (!recordDate) { setError('Date requise'); return; }
    setLoading(true); setError(null);
    try {
      const body: Record<string, any> = {
        type,
        title: title.trim(),
        description,
        record_date: recordDate,
      };
      if (doctor.trim()) body.doctor = doctor.trim();
      if (childId) body.child_id = childId;

      const res = await fetch(`${API_BASE}/api/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); return; }
      onSaved();
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  }

  const types = Object.keys(HEALTH_TYPES);

  return (
    <View style={[modalStyles.container, { backgroundColor: theme.background }]}>
      <View style={modalStyles.header}>
        <Text style={[modalStyles.title, { color: theme.text }]}>Ajouter un enregistrement</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={modalStyles.body}>
        {childrenList.length > 0 && (
          <>
            <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Enfant</Text>
            <View style={modalStyles.grid}>
              <TouchableOpacity
                style={[
                  modalStyles.chip,
                  { borderColor: theme.border },
                  !childId && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setChildId('')}
              >
                <Text style={[modalStyles.chipText, { color: !childId ? '#FFF' : theme.text }]}>
                  Général
                </Text>
              </TouchableOpacity>
              {childrenList.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    modalStyles.chip,
                    { borderColor: theme.border },
                    childId === child.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => setChildId(child.id)}
                >
                  <Text style={[modalStyles.chipText, { color: childId === child.id ? '#FFF' : theme.text }]}>
                    {child.first_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Type</Text>
        <View style={modalStyles.grid}>
          {types.map((t) => {
            const ht = HEALTH_TYPES[t];
            return (
              <TouchableOpacity
                key={t}
                style={[
                  modalStyles.chip,
                  { borderColor: theme.border },
                  type === t && { backgroundColor: ht.color, borderColor: ht.color },
                ]}
                onPress={() => setType(t)}
              >
                <Text style={{ fontSize: 14 }}>{ht.emoji}</Text>
                <Text style={[
                  modalStyles.chipText,
                  { color: type === t ? '#FFF' : theme.text },
                ]}>
                  {ht.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Titre</Text>
        <TextInput
          style={[modalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="Titre"
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Description</Text>
        <TextInput
          style={[modalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, minHeight: 60 }]}
          placeholder="Description (optionnelle)"
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Date</Text>
        <TextInput
          style={[modalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textSecondary}
          value={recordDate}
          onChangeText={setRecordDate}
        />

        <Text style={[modalStyles.label, { color: theme.textSecondary }]}>Médecin</Text>
        <TextInput
          style={[modalStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="Nom du médecin (optionnel)"
          placeholderTextColor={theme.textSecondary}
          value={doctor}
          onChangeText={setDoctor}
        />

        {error && (
          <View style={modalStyles.errorBanner}>
            <Text style={modalStyles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
      <TouchableOpacity
        style={[modalStyles.saveBtn, { backgroundColor: loading ? theme.textSecondary : '#276749' }]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : (
          <Text style={modalStyles.saveBtnText}>Enregistrer</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Écran Finances ────────────────────────────────────────────

export default function FinancesScreen() {
  const insets       = useSafeAreaInsets();
  const { theme }    = useTheme();
  const { token, user } = useAuth();
  const { t, lang }  = useTranslation();

  const today = new Date();
  const [month,      setMonth]    = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [expenses,   setExpenses] = useState<Expense[]>([]);
  const [balance,    setBalance]  = useState<Balance | null>(null);
  const [familyId,   setFamilyId] = useState<string | null>(null);
  const [coparent,   setCoparent] = useState<string | null>(null);
  const [loading,    setLoading]  = useState(true);
  const [showForm,   setShowForm] = useState(false);
  const [exporting,  setExporting] = useState<'csv' | 'pdf' | null>(null);

  // ── Charger famille ────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/families/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const f = d.family;
        if (!f) { setLoading(false); return; }
        setFamilyId(f.id);
        const otherName = f.parent_a_id === user?.id
          ? (d.parentB?.first_name) ?? null
          : (d.parentA?.first_name) ?? null;
        setCoparent(otherName);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [token]);

  // ── Charger dépenses ───────────────────────────────────────
  const loadExpenses = useCallback(async (fid: string, m: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/expenses?familyId=${fid}&month=${m}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const d = await res.json();
        setExpenses(d.expenses ?? []);
        setBalance(d.balance ?? null);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (familyId) loadExpenses(familyId, month);
  }, [familyId, month]);

  // ── Navigation mois ────────────────────────────────────────
  function prevMonth() {
    const [y, m] = month.split('-').map(Number);
    if (m === 1) setMonth(`${y - 1}-12`);
    else setMonth(`${y}-${String(m - 1).padStart(2, '0')}`);
  }
  function nextMonth() {
    const [y, m] = month.split('-').map(Number);
    if (m === 12) setMonth(`${y + 1}-01`);
    else setMonth(`${y}-${String(m + 1).padStart(2, '0')}`);
  }

  // ── Export CSV / PDF ───────────────────────────────────────
  async function handleExport(format: 'csv' | 'pdf') {
    if (!token) return;
    setExporting(format);
    try {
      const [yStr, mStr] = month.split('-');
      const res = await fetch(
        `${API_BASE}/api/exports/expenses/${format}?month=${parseInt(mStr)}&year=${parseInt(yStr)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;

      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const fileExt = format === 'csv' ? 'csv' : 'pdf';
        const fileUri = `${FileSystem.cacheDirectory}export_expenses.${fileExt}`;

        await FileSystem.writeAsStringAsync(fileUri, base64.split(',')[1], {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: format === 'csv' ? 'text/csv' : 'application/pdf',
            dialogTitle: `Exporter les dépenses (${format.toUpperCase()})`,
          });
        }
      };
      reader.readAsDataURL(blob);
    } catch {}
    finally { setExporting(null); }
  }

  const [y, m] = month.split('-').map(Number);
  const monthNames = shortMonths(lang);
  const monthLabel = `${monthNames[m - 1]} ${y}`;

  const catLabels = tList('finances.categories', lang);

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ─ Header ─ */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>{t('finances.title')}</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={18} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : !familyId ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>👨‍👩‍👧</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t('finances.noFamily')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

          {/* ─ Bilan ─ */}
          {balance && (
            <View style={{ marginTop: 16 }}>
              <BalanceCard balance={balance} theme={theme} coparentName={coparent} t={t} />
            </View>
          )}

          {/* ─ Résumé mois ─ */}
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{expenses.length}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('finances.expenses')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatAmount(total)}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('finances.total')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatAmount(total / 2)}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('finances.myShare')}</Text>
            </View>
          </View>

          {/* ─ Boutons d'export ─ */}
          <View style={styles.exportRow}>
            <TouchableOpacity
              style={[styles.exportBtn, { borderColor: theme.border }]}
              onPress={() => handleExport('csv')}
              disabled={exporting !== null}
            >
              {exporting === 'csv' ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>📄</Text>
                  <Text style={[styles.exportBtnText, { color: theme.primary }]}>
                    {t('finances.exportCSV') ?? 'Exporter CSV'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { borderColor: theme.border }]}
              onPress={() => handleExport('pdf')}
              disabled={exporting !== null}
            >
              {exporting === 'pdf' ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>📕</Text>
                  <Text style={[styles.exportBtnText, { color: theme.primary }]}>
                    {t('finances.exportPDF') ?? 'Exporter PDF'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ─ Liste des dépenses ─ */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('finances.detail')}</Text>

          {expenses.length === 0 ? (
            <View style={[styles.emptyList, { borderColor: theme.border }]}>
              <Text style={{ fontSize: 40 }}>💸</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('finances.noExpenses')}</Text>
            </View>
          ) : (
            expenses.map((exp) => {
              const cat      = CATEGORIES[exp.category];
              const isMine   = exp.paid_by === user?.id;
              const ratio    = parseFloat(exp.split_ratio);
              const myShare  = isMine
                ? parseFloat(exp.amount) * (1 - ratio)   // j'ai payé, l'autre me doit sa part
                : parseFloat(exp.amount) * ratio;          // l'autre a payé, je lui dois ma part

              return (
                <View
                  key={exp.id}
                  style={[styles.expCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={[styles.expIconWrapper, { backgroundColor: cat.color + '18' }]}>
                    <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.expTitle, { color: theme.text }]}>{exp.title}</Text>
                    <Text style={[styles.expMeta, { color: theme.textSecondary }]}>
                      {formatDate(exp.expense_date)} · {isMine ? t('finances.you') : exp.payer_first_name}
                      {' · '}{catLabels[(Object.keys(CATEGORIES) as Category[]).indexOf(exp.category)] ?? cat.label}
                    </Text>
                  </View>
                  <View style={styles.expAmounts}>
                    <Text style={[styles.expTotal, { color: theme.text }]}>
                      {formatAmount(exp.amount)}
                    </Text>
                    <Text style={[
                      styles.expShare,
                      { color: isMine ? '#276749' : theme.danger },
                    ]}>
                      {isMine ? `+${formatAmount(myShare)}` : `-${formatAmount(myShare)}`}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          {/* ─ Coffre-fort documentaire ─ */}
          {token && <VaultSection token={token} t={t} />}

          {/* ─ Carnet de santé ─ */}
          {token && <HealthSection token={token} t={t} />}

        </ScrollView>
      )}

      {/* ─ FAB ─ */}
      {familyId && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#276749', bottom: insets.bottom + 20 }]}
          onPress={() => setShowForm(true)}
          accessibilityLabel={t('finances.addExpense')}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* ─ Modal formulaire ─ */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        {familyId && token && (
          <AddExpenseForm
            familyId={familyId}
            token={token}
            onSaved={() => { setShowForm(false); if (familyId) loadExpenses(familyId, month); }}
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

// ─── Styles communs ───────────────────────────────────────────

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center', gap: 8, padding: 24,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12,
  },
  text: { fontSize: 13, textAlign: 'center' },
});

const itemStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 6,
  },
  badge: {
    width: 36, height: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '600' },
  meta:  { fontSize: 11, marginTop: 2 },
});

const addBtnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 10, marginTop: 8,
  },
  text: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

const childChipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5,
  },
  text: { fontSize: 12, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800' },
  body:   { padding: 20, gap: 0 },
  label:  { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  uploadBtn: {
    borderWidth: 1.5, borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 24, alignItems: 'center', gap: 8, marginBottom: 16,
  },
  uploadText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 13 },
  errorBanner: { backgroundColor: '#FFF5F5', borderRadius: 8, padding: 10, marginTop: 8 },
  errorText:   { color: '#C53030', fontSize: 13 },
  saveBtn: {
    margin: 20, borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

// ─── Styles FinancesScreen ───────────────────────────────────S

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  monthNav:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn:      { padding: 6 },
  monthLabel:  { fontSize: 14, fontWeight: '700', color: '#FFF', minWidth: 76, textAlign: 'center' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Résumé
  summaryCard: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, borderWidth: 1, padding: 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 4 },
  summaryValue:   { fontSize: 16, fontWeight: '800' },
  summaryLabel:   { fontSize: 11, fontWeight: '600' },
  summaryDivider: { width: 1, marginHorizontal: 8 },

  // Export
  exportRow: {
    flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16,
  },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 10,
  },
  exportBtnText: { fontSize: 13, fontWeight: '700' },

  sectionTitle: { fontSize: 15, fontWeight: '800', margin: 16, marginBottom: 8 },

  emptyList: {
    alignItems: 'center', gap: 8, margin: 16, padding: 32,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12,
  },

  // Carte dépense
  expCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  expIconWrapper: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  expTitle:       { fontSize: 15, fontWeight: '600' },
  expMeta:        { fontSize: 12, marginTop: 2 },
  expAmounts:     { alignItems: 'flex-end', gap: 2 },
  expTotal:       { fontSize: 15, fontWeight: '800' },
  expShare:       { fontSize: 12, fontWeight: '700' },

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
