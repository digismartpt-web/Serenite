import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../hooks/useAuth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

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

function formatAmount(n: string | number): string {
  return parseFloat(String(n)).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Carte bilan ──────────────────────────────────────────────

function BalanceCard({
  balance, theme, coparentName,
}: {
  balance: Balance;
  theme:   ReturnType<typeof useTheme>['theme'];
  coparentName: string | null;
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
              ? 'Comptes équilibrés'
              : balance.iOwe > 0
                ? `Vous devez à ${coparentName ?? 'votre coparent'}`
                : `${coparentName ?? 'Votre coparent'} vous doit`}
          </Text>
          {!balanced && (
            <Text style={[balStyles.amount, { color: balance.iOwe > 0 ? '#8C2B1E' : '#276749' }]}>
              {formatAmount(balance.iOwe > 0 ? balance.iOwe : balance.theyOwe)}
            </Text>
          )}
          {balanced && (
            <Text style={[balStyles.subLabel, { color: '#276749' }]}>
              Tous les frais sont partagés équitablement.
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
}

function AddExpenseForm({ familyId, token, onSaved, onClose, theme }: AddExpenseFormProps) {
  const [title,    setTitle]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState<Category>('autre');
  const [split,    setSplit]    = useState(50); // percentage
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSave() {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!title.trim())   { setError('Le titre est requis'); return; }
    if (isNaN(amt) || amt <= 0) { setError('Montant invalide'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/expenses`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          familyId,
          title:      title.trim(),
          amount:     amt,
          category,
          splitRatio: split / 100,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); return; }
      onSaved();
    } catch { setError('Impossible de contacter le serveur'); }
    finally { setLoading(false); }
  }

  const splits = [25, 33, 50, 67, 75, 100];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[expFormStyles.sheet, { backgroundColor: theme.surface }]}>

        <View style={expFormStyles.handle} />

        <View style={expFormStyles.header}>
          <Text style={[expFormStyles.title, { color: theme.text }]}>Nouvelle dépense</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={expFormStyles.body} keyboardShouldPersistTaps="handled">

          {/* Titre */}
          <TextInput
            style={[expFormStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder="Intitulé de la dépense"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          {/* Montant */}
          <View style={expFormStyles.amountRow}>
            <TextInput
              style={[expFormStyles.amountInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <View style={[expFormStyles.currencyBadge, { backgroundColor: theme.primary }]}>
              <Text style={expFormStyles.currencyText}>€</Text>
            </View>
          </View>

          {/* Catégorie */}
          <Text style={[expFormStyles.label, { color: theme.textSecondary }]}>Catégorie</Text>
          <View style={expFormStyles.catGrid}>
            {(Object.keys(CATEGORIES) as Category[]).map((cat) => (
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
                  {CATEGORIES[cat].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Répartition */}
          <Text style={[expFormStyles.label, { color: theme.textSecondary }]}>
            Ma part : {split}% — Coparent : {100 - split}%
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
              <Text style={expFormStyles.saveBtnText}>Enregistrer</Text>
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

// ─── Écran Finances ────────────────────────────────────────────

export default function FinancesScreen() {
  const insets       = useSafeAreaInsets();
  const { theme }    = useTheme();
  const { token, user } = useAuth();

  const today = new Date();
  const [month,      setMonth]    = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [expenses,   setExpenses] = useState<Expense[]>([]);
  const [balance,    setBalance]  = useState<Balance | null>(null);
  const [familyId,   setFamilyId] = useState<string | null>(null);
  const [coparent,   setCoparent] = useState<string | null>(null);
  const [loading,    setLoading]  = useState(true);
  const [showForm,   setShowForm] = useState(false);

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

  const [y, m] = month.split('-').map(Number);
  const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const monthLabel = `${MOIS_FR[m - 1]} ${y}`;

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ─ Header ─ */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Finances</Text>
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
            Invitez votre coparent pour{'\n'}partager les dépenses.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

          {/* ─ Bilan ─ */}
          {balance && (
            <View style={{ marginTop: 16 }}>
              <BalanceCard balance={balance} theme={theme} coparentName={coparent} />
            </View>
          )}

          {/* ─ Résumé mois ─ */}
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{expenses.length}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Dépenses</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatAmount(total)}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatAmount(total / 2)}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Ma part (50%)</Text>
            </View>
          </View>

          {/* ─ Liste des dépenses ─ */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Détail</Text>

          {expenses.length === 0 ? (
            <View style={[styles.emptyList, { borderColor: theme.border }]}>
              <Text style={{ fontSize: 40 }}>💸</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Aucune dépense ce mois-ci</Text>
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
                      {formatDate(exp.expense_date)} · {isMine ? 'Vous' : exp.payer_first_name}
                      {' · '}{cat.label}
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

        </ScrollView>
      )}

      {/* ─ FAB ─ */}
      {familyId && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#276749', bottom: insets.bottom + 20 }]}
          onPress={() => setShowForm(true)}
          accessibilityLabel="Ajouter une dépense"
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
          />
        )}
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

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
