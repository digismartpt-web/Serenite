import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { LANGUAGES } from '../../i18n/translations';
import { useTranslation } from '../../i18n/useTranslation';

export default function Step1Screen() {
  const router = useRouter();
  const { t, lang, setLang, restoreLang } = useTranslation();

  useEffect(() => { restoreLang(); }, []);

  function handleContinue() {
    router.push('/onboarding/step2');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      {/* Logo + Titre */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🕊️</Text>
        </View>
        <Text style={styles.appName}>{t('onboarding.title')}</Text>
        <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>
      </View>

      {/* Sélection de langue */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('onboarding.chooseLanguage')}</Text>

        <View style={styles.langGrid}>
          {LANGUAGES.map((l) => {
            const isSelected = lang === l.code;
            return (
              <TouchableOpacity
                key={l.code}
                style={[styles.langBtn, isSelected && styles.langBtnSelected]}
                onPress={() => setLang(l.code)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={l.label}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>
                  {l.label}
                </Text>
                {isSelected && <View style={styles.langCheck} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bouton Commencer */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={handleContinue}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.startRegistration')}
      >
        <Text style={styles.primaryBtnText}>{t('onboarding.start')}</Text>
      </TouchableOpacity>

      {/* Lien connexion */}
      <Text style={styles.loginHint}>
        {t('onboarding.alreadyAccount')}{' '}
        <Text
          style={styles.loginLink}
          onPress={() => router.push('/auth/login')}
          accessibilityRole="link"
        >
          {t('onboarding.login')}
        </Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 28,
  },
  hero: {
    alignItems: 'center',
    marginTop: 24,
    gap: 10,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  logoEmoji: {
    fontSize: 46,
  },
  appName: {
    fontSize:      32,
    fontWeight:    '800',
    color:         '#1A3A5C',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize:   15,
    color:      '#5A7499',
    textAlign:  'center',
    lineHeight: 22,
  },
  section: {
    alignSelf: 'stretch',
    gap: 12,
  },
  sectionLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#8A9BB0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign:  'center',
  },
  langGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            10,
    justifyContent: 'center',
  },
  langBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingVertical:  12,
    paddingHorizontal: 18,
    borderRadius:   10,
    borderWidth:    1.5,
    borderColor:    '#D8DCE6',
    backgroundColor: '#FFFFFF',
    minWidth:       140,
    cursor:         'pointer',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  langBtnSelected: {
    borderColor:     '#1D9E75',
    backgroundColor: '#FAFFFE',
  },
  langFlag: {
    fontSize: 20,
  },
  langLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '500',
    color:      '#3A4A5C',
  },
  langLabelSelected: {
    color:      '#1D9E75',
    fontWeight: '700',
  },
  langCheck: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#1D9E75',
  },
  primaryBtn: {
    alignSelf:       'stretch',
    backgroundColor: '#1A3A5C',
    borderRadius:    10,
    paddingVertical: 16,
    alignItems:      'center',
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  primaryBtnText: {
    color:      '#FFFFFF',
    fontSize:   17,
    fontWeight: '700',
  },
  loginHint: {
    fontSize:  14,
    color:     '#8A9BB0',
  },
  loginLink: {
    color:      '#1A3A5C',
    fontWeight: '700',
  },
});
