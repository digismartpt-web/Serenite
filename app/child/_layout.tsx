import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Platform, Vibration, StatusBar,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const SecureStore = typeof window !== 'undefined' && window.localStorage
  ? { getItemAsync: async (k) => { try { return localStorage.getItem(k) } catch(e) { return null } }, setItemAsync: async (k, v) => { try { localStorage.setItem(k, v) } catch(e) {} } }
  : require('expo-secure-store');

// ─── Constantes ───────────────────────────────────────────────

const CHILD_PURPLE  = '#5B3FA0';
const CHILD_DARK    = '#3D2870';
const CHILD_LIGHT   = '#FAF5FF';
const CHILD_BORDER  = '#E9D8FD';
const CHILD_ACCENT  = '#F6AD55';
const PIN_LENGTH    = 4;
const SECURE_KEY    = 'serenite_child_pin';

// ─── Clavier PIN ──────────────────────────────────────────────

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

function PinDots({ value, shake }: { value: string; shake: Animated.Value }) {
  return (
    <Animated.View
      style={[
        pinStyles.dotsRow,
        { transform: [{ translateX: shake }] },
      ]}
    >
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <View
          key={i}
          style={[
            pinStyles.dot,
            value.length > i && pinStyles.dotFilled,
          ]}
        />
      ))}
    </Animated.View>
  );
}

// ─── Écran de saisie PIN ──────────────────────────────────────

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  function doShake() {
    Vibration.vibrate(300);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleKey(key: string) {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (key === '') return;
    const next = pin + key;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      const saved = await SecureStore.getItemAsync(SECURE_KEY);
      if (!saved) {
        // Premier accès : on sauvegarde le PIN
        await SecureStore.setItemAsync(SECURE_KEY, next);
        onSuccess();
      } else if (saved === next) {
        onSuccess();
      } else {
        setError('Code incorrect');
        doShake();
        setPin('');
      }
    }
  }

  return (
    <View style={[pinStyles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar barStyle="light-content" backgroundColor={CHILD_DARK} />

      {/* Retour */}
      <TouchableOpacity style={pinStyles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Logo */}
      <View style={pinStyles.logoArea}>
        <Text style={pinStyles.logoEmoji}>🦄</Text>
        <Text style={pinStyles.logoTitle}>Espace Enfant</Text>
        <Text style={pinStyles.logoSub}>Entre ton code secret</Text>
      </View>

      {/* Points */}
      <PinDots value={pin} shake={shake} />
      {error ? <Text style={pinStyles.errorText}>{error}</Text> : null}

      {/* Clavier */}
      <View style={pinStyles.keyboard}>
        {KEYS.map((key, idx) => (
          <TouchableOpacity
            key={idx}
            style={[pinStyles.key, key === '' && pinStyles.keyEmpty]}
            onPress={() => handleKey(key)}
            disabled={key === ''}
            activeOpacity={0.7}
          >
            <Text style={pinStyles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={pinStyles.hint}>
        {!pin && 'La première fois, ton code sera créé automatiquement'}
      </Text>
    </View>
  );
}

// ─── Layout principal ──────────────────────────────────────────

export default function ChildLayout() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PinScreen onSuccess={() => setUnlocked(true)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle:      { backgroundColor: CHILD_PURPLE },
        headerTintColor:  '#FFF',
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        contentStyle:     { backgroundColor: CHILD_LIGHT },
      }}
    >
      <Stack.Screen
        name="home"
        options={{
          title: 'Mon Espace',
          headerLeft: () => null,   // pas de retour depuis home
        }}
      />
    </Stack>
  );
}

// ─── Styles PIN ────────────────────────────────────────────────

const pinStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CHILD_DARK,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    padding: 8,
  },
  logoArea: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  logoEmoji: { fontSize: 60 },
  logoTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', marginTop: 8 },
  logoSub:   { fontSize: 15, color: '#C4B5FD', marginTop: 6 },

  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#C4B5FD',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: CHILD_ACCENT, borderColor: CHILD_ACCENT },
  errorText: { color: '#FC8181', fontSize: 14, marginBottom: 8, fontWeight: '600' },

  keyboard: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 280, marginTop: 32, gap: 12,
    justifyContent: 'center',
  },
  key: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: CHILD_PURPLE,
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  keyEmpty: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
  keyText:  { fontSize: 26, fontWeight: '700', color: '#FFF' },

  hint: { marginTop: 24, color: '#8B6FCC', fontSize: 12, textAlign: 'center', paddingHorizontal: 40 },
});
