import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTranslation } from '../../i18n/useTranslation';

// ─── Schéma Zod (fabrique avec traduction) ────────────────────

function calcAge(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age;
}

function getIdentitySchema(t: (key: string, opts?: Record<string, unknown>) => string) {
  return z.object({
    firstName: z
      .string({ required_error: t('step2.err.firstNameReq') })
      .min(2, t('minChars', { n: 2 }))
      .max(100)
      .trim(),
    lastName: z
      .string({ required_error: t('step2.err.lastNameReq') })
      .min(2, t('minChars', { n: 2 }))
      .max(100)
      .trim(),
    email: z
      .string({ required_error: t('step2.err.emailReq') })
      .email(t('step2.err.emailInvalid'))
      .transform((v) => v.toLowerCase().trim()),
    phone: z
      .string({ required_error: t('step2.err.phoneReq') })
      .transform((v) => v.replace(/[\s\-()./ ]/g, ''))
      .refine((v) => /^\+?\d{7,15}$/.test(v), t('step2.err.phoneFormat')),
    address: z.string().max(500).trim().optional(),
    birthDate: z
      .date({ required_error: t('step2.err.birthDateReq') })
      .refine(
        (d) => calcAge(d) >= 18,
        t('step2.err.ageUnder18')
      ),
  });
}

type FormData = z.infer<ReturnType<typeof getIdentitySchema>>;

// ─── Helpers d'affichage ──────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ─── Composant champ de formulaire ────────────────────────────

interface FieldProps {
  label:       string;
  error?:      string;
  required?:   boolean;
  children:    React.ReactNode;
}

function Field({ label, error, required, children }: FieldProps) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>
        {label}
        {required && <Text style={fieldStyles.required}> *</Text>}
      </Text>
      {children}
      {error && <Text style={fieldStyles.errorText}>{error}</Text>}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper:    { gap: 5 },
  label:      { fontSize: 13, fontWeight: '600', color: '#3A4A5C' },
  required:   { color: '#E53E3E' },
  errorText:  { fontSize: 12, color: '#E53E3E', marginTop: 2 },
});

// ─── Styles d'input dynamiques ────────────────────────────────

function inputStyle(value: string | undefined, hasError: boolean) {
  const filled = !!value?.trim();
  return [
    styles.input,
    filled   && !hasError && styles.inputValid,
    hasError && styles.inputError,
  ];
}

// ─── Écran step 2 ─────────────────────────────────────────────

export default function Step2Screen() {
  const router          = useRouter();
  const { data, patch } = useOnboarding();
  const { t } = useTranslation();

  const [showDatePicker, setShowDatePicker] = useState(false);

  const schema = useMemo(() => getIdentitySchema(t), [t]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: data.firstName || undefined,
      lastName:  data.lastName  || undefined,
      email:     data.email     || undefined,
      phone:     data.phone     || undefined,
      address:   data.address   || undefined,
      birthDate: data.birthDate || undefined,
    },
  });

  const watchedDate = watch('birthDate');
  const displayAge  = watchedDate ? calcAge(watchedDate) : null;

  function onSubmit(values: FormData) {
    patch({
      firstName: values.firstName,
      lastName:  values.lastName,
      email:     values.email,
      phone:     values.phone,
      address:   values.address,
      birthDate: values.birthDate,
    });
    router.push('/onboarding/step3');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>{t('step2.title')}</Text>
        <Text style={styles.pageSubtitle}>
          {t('step2.subtitle')}
        </Text>

        {/* ─ Prénom ─ */}
        <Field label={t('step2.firstName')} required error={errors.firstName?.message}>
          <Controller
            control={control}
            name="firstName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={inputStyle(value, !!errors.firstName)}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('step2.firstNamePH')}
                placeholderTextColor="#A0AEC0"
                autoCapitalize="words"
                returnKeyType="next"
                accessibilityLabel={t('step2.firstName')}
              />
            )}
          />
        </Field>

        {/* ─ Nom ─ */}
        <Field label={t('step2.lastName')} required error={errors.lastName?.message}>
          <Controller
            control={control}
            name="lastName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={inputStyle(value, !!errors.lastName)}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('step2.lastNamePH')}
                placeholderTextColor="#A0AEC0"
                autoCapitalize="words"
                returnKeyType="next"
                accessibilityLabel={t('step2.lastName')}
              />
            )}
          />
        </Field>

        {/* ─ Email ─ */}
        <Field label={t('step2.email')} required error={errors.email?.message}>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={inputStyle(value, !!errors.email)}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('step2.emailPH')}
                placeholderTextColor="#A0AEC0"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                accessibilityLabel={t('step2.email')}
              />
            )}
          />
        </Field>

        {/* ─ Téléphone ─ */}
        <Field label={t('step2.phone')} required error={errors.phone?.message}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={inputStyle(value, !!errors.phone)}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('step2.phonePH')}
                placeholderTextColor="#A0AEC0"
                keyboardType="phone-pad" inputMode="tel"
                returnKeyType="next"
                accessibilityLabel={t('step2.phone')}
              />
            )}
          />
        </Field>

        {/* ─ Adresse ─ */}
        <Field label={t('step2.address')} error={errors.address?.message}>
          <Controller
            control={control}
            name="address"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[inputStyle(value, !!errors.address), styles.inputMultiline]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('step2.addressPH')}
                placeholderTextColor="#A0AEC0"
                autoCapitalize="words"
                multiline
                numberOfLines={2}
                returnKeyType="next"
                accessibilityLabel={t('step2.address')}
              />
            )}
          />
        </Field>

        {/* ─ Date de naissance ─ */}
        <Field label={t('step2.birthDate')} required error={errors.birthDate?.message}>
          <Controller
            control={control}
            name="birthDate"
            render={({ field: { value, onChange } }) => (
              <>
                {/* Bouton d'ouverture uniquement sur natif */}
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={[
                      styles.input,
                      styles.dateBtn,
                      value && !errors.birthDate && styles.inputValid,
                      !!errors.birthDate && styles.inputError,
                    ]}
                    onPress={() => setShowDatePicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={value ? t('step2.dateAria', { date: formatDate(value) }) : t('step2.pickDate')}
                  >
                    <Text style={[styles.dateBtnText, !value && styles.dateBtnPlaceholder]}>
                      {value ? formatDate(value) : t('step2.birthDatePH')}
                    </Text>
                    {displayAge !== null && displayAge >= 18 && (
                      <View style={styles.ageChip}>
                        <Text style={styles.ageChipText}>{t('step2.age', { age: displayAge })}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={value instanceof Date && !isNaN(value.getTime())
                      ? value.toISOString().split('T')[0]
                      : ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const d = e.target.value ? new Date(e.target.value + 'T12:00:00') : new Date();
                      if (!isNaN(d.getTime())) onChange(d);
                    }}
                    style={{
                      width: '100%', padding: '12px 16px', fontSize: 16,
                      border: '1px solid ' + (errors?.birthDate ? '#E53E3E' : '#CBD5E0'),
                      borderRadius: 8, background: '#fff', color: '#1A202C',
                      fontFamily: 'inherit',
                    } as React.CSSProperties}
                  />
                ) : showDatePicker && (
                  <DateTimePicker
                    value={value ?? new Date(1990, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    minimumDate={new Date(1920, 0, 1)}
                    onChange={(_event, date) => {
                      if (Platform.OS !== 'ios') setShowDatePicker(false);
                      if (date) onChange(date);
                    }}
                    locale="fr-FR"
                  />
                )}

                {/* Bouton "Confirmer" sur iOS pour fermer le spinner */}
                {Platform.OS === 'ios' && showDatePicker && (
                  <TouchableOpacity
                    style={styles.dateConfirmBtn}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.dateConfirmBtnText}>{t('confirm')}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          />
        </Field>

        {/* ─ Bouton suivant ─ */}
        <TouchableOpacity
          style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>
            {isSubmitting ? t('step2.verifying') : t('continue')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
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
    marginTop:  -8,
    marginBottom: 4,
  },

  // ── Input ──────────────────────────────────────────────────
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth:     1.5,
    borderColor:     '#D8DCE6',
    borderRadius:    9,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize:        16,
    color:           '#1A202C',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  inputValid: {
    borderColor:     '#1D9E75',
    backgroundColor: '#FAFFFE',
  },
  inputError: {
    borderColor:     '#E53E3E',
    backgroundColor: '#FFF5F5',
  },
  inputMultiline: {
    minHeight:  80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  // ── Date picker ───────────────────────────────────────────
  dateBtn: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  dateBtnText: {
    fontSize:   16,
    color:      '#1A202C',
  },
  dateBtnPlaceholder: {
    color: '#A0AEC0',
  },
  ageChip: {
    backgroundColor: '#EDF7F3',
    borderRadius:    12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ageChipText: {
    fontSize:   12,
    color:      '#1D9E75',
    fontWeight: '700',
  },
  dateConfirmBtn: {
    alignSelf:       'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop:       4,
    backgroundColor: '#1A3A5C',
    borderRadius:    8,
  },
  dateConfirmBtnText: {
    color:      '#FFFFFF',
    fontSize:   14,
    fontWeight: '600',
  },

  // ── Bouton ────────────────────────────────────────────────
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
});
