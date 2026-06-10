import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '../../i18n/useTranslation';
import { useOnboarding, ParentType, ParentStatus } from '../../contexts/OnboardingContext';

// ─── Données ──────────────────────────────────────────────────

const PARENT_TYPES: { value: ParentType; label: string; emoji: string }[] = [
  { value: 'papa',        label: 'Papa',        emoji: '👨' },
  { value: 'maman',       label: 'Maman',       emoji: '👩' },
  { value: 'beau-pere',   label: 'Beau-père',   emoji: '👨‍👧' },
  { value: 'belle-mere',  label: 'Belle-mère',  emoji: '👩‍👧' },
];

const STATUSES: { value: ParentStatus; label: string; desc: string }[] = [
  { value: 'separated', label: 'Séparé(e)',  desc: 'Non encore divorcé(e) officiellement' },
  { value: 'divorced',  label: 'Divorcé(e)', desc: 'Divorce prononcé par le tribunal' },
];

const MIN_CHILDREN = 1;
const MAX_CHILDREN = 10;

export default function Step3Screen() {
  const router          = useRouter();
  const { data, patch } = useOnboarding();
  const { t }           = useTranslation();

  const [parentType, setParentType] = useState<ParentType | undefined>(data.parentType);
  const [status,     setStatus]     = useState<ParentStatus | undefined>(data.parentStatus);
  const [count,      setCount]      = useState<number>(data.childrenCount);

  const canContinue = !!parentType && !!status;

  function handleParentType(value: ParentType) {
    setParentType(value);
  }

  function handleStatus(value: ParentStatus) {
    setStatus(value);
  }

  function increment() {
    setCount((n) => Math.min(n + 1, MAX_CHILDREN));
  }

  function decrement() {
    setCount((n) => Math.max(n - 1, MIN_CHILDREN));
  }

  function handleContinue() {
    if (!parentType || !status) return;
    patch({ parentType, parentStatus: status, childrenCount: count });
    router.push('/onboarding/step4');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>{t('step3.title')}</Text>
      <Text style={styles.pageSubtitle}>
        {t('step3.subtitle')}
      </Text>

      {/* ─ Lien de parenté ─ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('step3.parentType')}</Text>
        <View style={styles.roleGrid}>
          {PARENT_TYPES.map((item) => {
            const isSelected = parentType === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.roleBtn, isSelected && styles.roleBtnSelected]}
                onPress={() => handleParentType(item.value)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={styles.roleEmoji}>{item.emoji}</Text>
                <Text style={[styles.roleLabel, isSelected && styles.roleLabelSelected]}>
                  {t('step3.parentType.' + item.value)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ─ Statut ─ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('step3.status')}</Text>
        <View style={styles.statusCol}>
          {STATUSES.map((item) => {
            const isSelected = status === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.statusBtn, isSelected && styles.statusBtnSelected]}
                onPress={() => handleStatus(item.value)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <View style={styles.statusTexts}>
                  <Text style={[styles.statusLabel, isSelected && styles.statusLabelSelected]}>
                    {t('step3.status.' + item.value)}
                  </Text>
                  <Text style={styles.statusDesc}>{t('step3.status.' + item.value + 'Desc')}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ─ Nombre d'enfants ─ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('step3.childrenCount')}</Text>
        <View style={styles.counter}>
          <TouchableOpacity
            style={[styles.counterBtn, count <= MIN_CHILDREN && styles.counterBtnDisabled]}
            onPress={decrement}
            disabled={count <= MIN_CHILDREN}
            accessibilityLabel={t('step3.decrease')}
            accessibilityRole="button"
          >
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>

          <View style={styles.counterDisplay} accessibilityLabel={`${count} ${t(count === 1 ? 'step3.child' : 'step3.children')}`}>
            <Text style={styles.counterValue}>{count}</Text>
            <Text style={styles.counterUnit}>{t(count === 1 ? 'step3.child' : 'step3.children')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.counterBtn, count >= MAX_CHILDREN && styles.counterBtnDisabled]}
            onPress={increment}
            disabled={count >= MAX_CHILDREN}
            accessibilityLabel={t('step3.increase')}
            accessibilityRole="button"
          >
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─ Bouton suivant ─ */}
      <TouchableOpacity
        style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canContinue }}
      >
        <Text style={styles.primaryBtnText}>{t('continue')}</Text>
      </TouchableOpacity>

      {!canContinue && (
        <Text style={styles.hintText}>
          {t('step3.helpText')}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
    gap: 24,
  },
  pageTitle: {
    fontSize:   26,
    fontWeight: '800',
    color:      '#1A3A5C',
    marginTop:  8,
  },
  pageSubtitle: {
    fontSize:   14,
    color:      '#5A7499',
    lineHeight: 20,
    marginTop:  -12,
  },

  // ── Section ───────────────────────────────────────────────────
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#8A9BB0',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  // ── Rôle ──────────────────────────────────────────────────────
  roleGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
  },
  roleBtn: {
    alignItems:       'center',
    justifyContent:   'center',
    gap:              6,
    paddingVertical:  16,
    paddingHorizontal: 12,
    borderRadius:     10,
    borderWidth:      1.5,
    borderColor:      '#D8DCE6',
    backgroundColor:  '#FFFFFF',
    flex:             1,
    minWidth:         '44%',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  roleBtnSelected: {
    borderColor:     '#1A3A5C',
    backgroundColor: '#EEF2FF',
  },
  roleEmoji: {
    fontSize: 26,
  },
  roleLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#3A4A5C',
  },
  roleLabelSelected: {
    color: '#1A3A5C',
  },

  // ── Statut ────────────────────────────────────────────────────
  statusCol: {
    gap: 10,
  },
  statusBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            14,
    padding:        16,
    borderRadius:   10,
    borderWidth:    1.5,
    borderColor:    '#D8DCE6',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  statusBtnSelected: {
    borderColor:     '#1D9E75',
    backgroundColor: '#FAFFFE',
  },
  radio: {
    width:       20,
    height:      20,
    borderRadius: 10,
    borderWidth:  2,
    borderColor:  '#CBD5E0',
    justifyContent: 'center',
    alignItems:   'center',
  },
  radioSelected: {
    borderColor: '#1D9E75',
  },
  radioDot: {
    width:           9,
    height:          9,
    borderRadius:    5,
    backgroundColor: '#1D9E75',
  },
  statusTexts: {
    flex: 1,
    gap:  2,
  },
  statusLabel: {
    fontSize:   15,
    fontWeight: '600',
    color:      '#1A3A5C',
  },
  statusLabelSelected: {
    color: '#1D9E75',
  },
  statusDesc: {
    fontSize:   12,
    color:      '#8A9BB0',
    lineHeight: 16,
  },

  // ── Compteur ──────────────────────────────────────────────────
  counter: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           20,
    paddingVertical: 8,
  },
  counterBtn: {
    width:          52,
    height:         52,
    borderRadius:   26,
    borderWidth:    1.5,
    borderColor:    '#1A3A5C',
    justifyContent: 'center',
    alignItems:     'center',
    backgroundColor: '#FFFFFF',
  },
  counterBtnDisabled: {
    borderColor:     '#D8DCE6',
    backgroundColor: '#F4F6FA',
  },
  counterBtnText: {
    fontSize:   24,
    fontWeight: '400',
    color:      '#1A3A5C',
    lineHeight: 28,
  },
  counterDisplay: {
    alignItems: 'center',
    minWidth:   64,
  },
  counterValue: {
    fontSize:   40,
    fontWeight: '800',
    color:      '#1A3A5C',
    lineHeight: 46,
  },
  counterUnit: {
    fontSize:   13,
    color:      '#8A9BB0',
    fontWeight: '500',
  },

  // ── Bouton ────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius:    10,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       8,
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  primaryBtnDisabled: {
    backgroundColor: '#A0AEC0',
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  primaryBtnText: {
    color:      '#FFFFFF',
    fontSize:   17,
    fontWeight: '700',
  },
  hintText: {
    fontSize:  13,
    color:     '#8A9BB0',
    textAlign: 'center',
    marginTop: -12,
  },
});
