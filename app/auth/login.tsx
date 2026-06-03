import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';

const SecureStore = Platform.OS === 'web'
  ? {
      setItemAsync: async (k: string, v: string): Promise<void> => { try { localStorage.setItem(k, v) } catch { } },
    }
  : require('expo-secure-store');

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const SECURE_TOKEN_KEY = 'serenite_auth_token';

export default function LoginScreen() {
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError('Email ou mot de passe incorrect.');
        } else {
          setError(body.error ?? 'Une erreur est survenue. Réessayez.');
        }
        return;
      }

      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, body.token);
      router.replace('/(tabs)/home');
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Retour */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🕊️</Text>
          </View>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Accédez à votre espace Sérénité</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Adresse email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(null); }}
              placeholder="exemple@email.com"
              placeholderTextColor="#A0AEC0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              accessibilityLabel="Adresse email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              placeholder="••••••••"
              placeholderTextColor="#A0AEC0"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Mot de passe"
            />
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, (loading || !email || !password) && styles.primaryBtnDisabled]}
            onPress={handleLogin}
            disabled={loading || !email || !password}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.primaryBtnText}>Se connecter</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Lien inscription */}
        <Text style={styles.hint}>
          Pas encore de compte ?{' '}
          <Text
            style={styles.hintLink}
            onPress={() => router.replace('/onboarding/step1')}
            accessibilityRole="link"
          >
            Créer un compte
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    gap: 28,
  },

  backBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  backBtnText: {
    fontSize:   15,
    color:      '#1A3A5C',
    fontWeight: '600',
  },

  hero: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  logoCircle: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: '#E8F0FE',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    4,
    ...Platform.select({
      ios:     { shadowColor: '#1A3A5C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  logoEmoji: { fontSize: 42 },
  title: {
    fontSize:   28,
    fontWeight: '800',
    color:      '#1A3A5C',
  },
  subtitle: {
    fontSize:  14,
    color:     '#5A7499',
    textAlign: 'center',
  },

  form: { gap: 16 },

  field: { gap: 5 },
  label: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#3A4A5C',
  },
  input: {
    backgroundColor:  '#FFFFFF',
    borderWidth:      1.5,
    borderColor:      '#D8DCE6',
    borderRadius:     9,
    paddingVertical:  13,
    paddingHorizontal: 14,
    fontSize:         16,
    color:            '#1A202C',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },

  errorBanner: {
    backgroundColor: '#FFF5F5',
    borderRadius:    10,
    padding:         14,
    borderWidth:     1,
    borderColor:     '#FEB2B2',
  },
  errorText: {
    fontSize:   13,
    color:      '#C53030',
    lineHeight: 18,
  },

  primaryBtn: {
    backgroundColor: '#1A3A5C',
    borderRadius:    10,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       4,
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

  hint: {
    fontSize:  14,
    color:     '#8A9BB0',
    textAlign: 'center',
  },
  hintLink: {
    color:      '#1A3A5C',
    fontWeight: '700',
  },
});
