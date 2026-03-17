import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Palette de couleurs calendrier (swatch picker)
const COLOR_SWATCHES = [
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#DBEAFE', text: '#1E40AF' },
];

function useAuthToken(): string {
  return (global as any).__devAuthToken ?? '';
}

function calcAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return Math.max(0, age);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

interface ChildForm {
  firstName: string;
  birthDate: Date;
  calendarColor: string;
  calendarColorText: string;
  createAutonomousAccess: boolean;
  showDatePicker: boolean;
  saved: boolean;
  saving: boolean;
  error: string | null;
}

function defaultChild(): ChildForm {
  return {
    firstName: '',
    birthDate: new Date(new Date().getFullYear() - 5, 0, 1),
    calendarColor: COLOR_SWATCHES[0].bg,
    calendarColorText: COLOR_SWATCHES[0].text,
    createAutonomousAccess: false,
    showDatePicker: false,
    saved: false,
    saving: false,
    error: null,
  };
}

export default function ChildrenScreen() {
  const router    = useRouter();
  const authToken = useAuthToken();

  // numChildren vient de l'étape d'inscription précédente (passé via params ou context)
  const { numChildren: numParam } = useLocalSearchParams<{ numChildren?: string }>();
  const numChildren = Math.max(1, parseInt(numParam ?? '1', 10) || 1);

  const [forms, setForms]     = useState<ChildForm[]>(() =>
    Array.from({ length: numChildren }, defaultChild)
  );
  const [finishing, setFinishing] = useState(false);

  const savedCount = forms.filter((f) => f.saved).length;
  const allSaved   = savedCount === numChildren;

  // ── Mettre à jour un champ d'un formulaire ──────────────────
  function update<K extends keyof ChildForm>(
    index: number,
    key: K,
    value: ChildForm[K]
  ) {
    setForms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  // ── Sauvegarder un enfant ────────────────────────────────────
  async function saveChild(index: number) {
    const form = forms[index];
    if (!form.firstName.trim()) {
      update(index, 'error', 'Le prénom est requis');
      return;
    }

    update(index, 'saving', true);
    update(index, 'error', null);

    try {
      const res = await fetch(`${API_BASE}/api/families/children`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          firstName:              form.firstName.trim(),
          birthDate:              form.birthDate.toISOString().split('T')[0],
          calendarColor:          form.calendarColor,
          calendarColorText:      form.calendarColorText,
          createAutonomousAccess: form.createAutonomousAccess,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        update(index, 'error', data.error ?? 'Erreur serveur');
        return;
      }

      update(index, 'saved', true);
    } catch {
      update(index, 'error', 'Impossible de contacter le serveur');
    } finally {
      update(index, 'saving', false);
    }
  }

  // ── Terminer l'onboarding ────────────────────────────────────
  async function finish() {
    setFinishing(true);
    router.replace('/(tabs)/home');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* En-tête */}
      <Text style={styles.pageTitle}>Vos enfants</Text>
      <Text style={styles.pageSubtitle}>
        Ajoutez les profils pour personnaliser le calendrier partagé
      </Text>

      {/* Progression */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(savedCount / numChildren) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.progressLabel}>
        {savedCount} enfant{savedCount !== 1 ? 's' : ''} ajouté{savedCount !== 1 ? 's' : ''} sur {numChildren}
      </Text>

      {/* Formulaires enfants */}
      {forms.map((form, index) => (
        <ChildCard
          key={index}
          index={index}
          form={form}
          onUpdate={(key, val) => update(index, key, val)}
          onSave={() => saveChild(index)}
        />
      ))}

      {/* Bouton Terminer */}
      <TouchableOpacity
        style={[styles.finishBtn, !allSaved && styles.finishBtnDisabled]}
        onPress={finish}
        disabled={!allSaved || finishing}
        activeOpacity={0.85}
      >
        <Text style={styles.finishBtnText}>
          {finishing ? 'Chargement…' : 'Terminer →'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── ChildCard ─────────────────────────────────────────────────

function ChildCard({
  index,
  form,
  onUpdate,
  onSave,
}: {
  index: number;
  form: ChildForm;
  onUpdate: <K extends keyof ChildForm>(key: K, val: ChildForm[K]) => void;
  onSave: () => void;
}) {
  const age      = calcAge(form.birthDate);
  const isOver12 = age >= 12;

  return (
    <View style={[styles.card, form.saved && styles.cardSaved]}>
      {/* Badge index */}
      <View style={styles.cardHeader}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.cardTitle}>
          {form.saved ? `✓  ${form.firstName}` : `Enfant ${index + 1}`}
        </Text>
      </View>

      {form.saved ? (
        <Text style={styles.savedLabel}>Profil enregistré</Text>
      ) : (
        <>
          {/* Prénom */}
          <View style={styles.field}>
            <Text style={styles.label}>Prénom *</Text>
            <TextInput
              style={styles.input}
              value={form.firstName}
              onChangeText={(v) => onUpdate('firstName', v)}
              placeholder="Ex : Emma"
              placeholderTextColor="#A0AEC0"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Date de naissance */}
          <View style={styles.field}>
            <Text style={styles.label}>Date de naissance *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => onUpdate('showDatePicker', !form.showDatePicker)}
            >
              <Text style={styles.dateButtonText}>{formatDate(form.birthDate)}</Text>
              <Text style={styles.dateAgeChip}>{age} an{age !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>

            {form.showDatePicker && (
              <DateTimePicker
                value={form.birthDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={new Date(1980, 0, 1)}
                onChange={(_event, date) => {
                  onUpdate('showDatePicker', Platform.OS !== 'ios');
                  if (date) onUpdate('birthDate', date);
                }}
                locale="fr-FR"
              />
            )}
          </View>

          {/* Couleur calendrier */}
          <View style={styles.field}>
            <Text style={styles.label}>Couleur du calendrier</Text>
            <View style={styles.swatchRow}>
              {COLOR_SWATCHES.map((swatch) => (
                <TouchableOpacity
                  key={swatch.bg}
                  style={[
                    styles.swatch,
                    { backgroundColor: swatch.bg },
                    form.calendarColor === swatch.bg && styles.swatchSelected,
                  ]}
                  onPress={() => {
                    onUpdate('calendarColor', swatch.bg);
                    onUpdate('calendarColorText', swatch.text);
                  }}
                >
                  {form.calendarColor === swatch.bg && (
                    <Text style={[styles.swatchCheck, { color: swatch.text }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Accès autonome (≥ 12 ans) */}
          {isOver12 && (
            <View style={styles.field}>
              <View style={styles.autonomousRow}>
                <View style={styles.autonomousTexts}>
                  <Text style={styles.label}>Accès autonome</Text>
                  <Text style={styles.autonomousSub}>
                    Crée un code à 8 chiffres pour que {form.firstName || 'l'enfant'} accède à son espace
                  </Text>
                </View>
                <Switch
                  value={form.createAutonomousAccess}
                  onValueChange={(v) => onUpdate('createAutonomousAccess', v)}
                  trackColor={{ false: '#CBD5E0', true: '#1A3A5C' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          )}

          {/* Erreur */}
          {form.error && (
            <Text style={styles.errorText}>{form.error}</Text>
          )}

          {/* Bouton Ajouter */}
          <TouchableOpacity
            style={[styles.addBtn, form.saving && styles.addBtnDisabled]}
            onPress={onSave}
            disabled={form.saving}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>
              {form.saving
                ? 'Enregistrement…'
                : `Ajouter ${form.firstName.trim() || 'cet enfant'}`}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A3A5C',
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#1A3A5C',
  },
  progressLabel: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    marginTop: -8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  cardSaved: {
    borderColor: '#9AE6B4',
    backgroundColor: '#F0FFF4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A3A5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indexBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A3A5C',
  },
  savedLabel: {
    fontSize: 14,
    color: '#276749',
    fontWeight: '600',
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1A202C',
    backgroundColor: '#F7F9FC',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F7F9FC',
  },
  dateButtonText: {
    fontSize: 15,
    color: '#1A202C',
  },
  dateAgeChip: {
    fontSize: 12,
    color: '#718096',
    backgroundColor: '#EDF2F7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: '#1A3A5C',
  },
  swatchCheck: {
    fontSize: 18,
    fontWeight: '800',
  },
  autonomousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autonomousTexts: {
    flex: 1,
    gap: 2,
  },
  autonomousSub: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#E53E3E',
  },
  addBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  addBtnDisabled: {
    backgroundColor: '#A0AEC0',
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  finishBtn: {
    backgroundColor: '#276749',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...Platform.select({
      ios:     { shadowColor: '#276749', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  finishBtnDisabled: {
    backgroundColor: '#A0AEC0',
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
