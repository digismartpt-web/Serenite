import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Finances — placeholder Wave 1
 * Implémentation complète : Wave 3
 */
export default function FinancesScreen() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={styles.emoji}>💰</Text>
      <Text style={[styles.title, { color: theme.text }]}>Finances</Text>
      <Text style={[styles.sub, { color: theme.textSecondary }]}>
        Disponible en Wave 3
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emoji:     { fontSize: 56 },
  title:     { fontSize: 22, fontWeight: '800' },
  sub:       { fontSize: 14 },
});
