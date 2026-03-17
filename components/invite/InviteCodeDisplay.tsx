import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

interface Props {
  code: string | null;
  onRefresh: () => void;
  loading?: boolean;
  /** Texte affiché sous le code (ex: "Expire dans 24h") */
  expiresLabel?: string;
}

/**
 * InviteCodeDisplay
 * Affiche un code d'invitation à 6 chiffres en cases stylisées.
 * Fond sombre (#1A3A5C), chiffres blancs, espacement lisible.
 */
export default function InviteCodeDisplay({
  code,
  onRefresh,
  loading = false,
  expiresLabel,
}: Props) {
  const digits = (code ?? '      ').split('');

  return (
    <View style={styles.wrapper}>
      {/* Cases du code */}
      <View style={styles.row}>
        {digits.map((digit, index) => (
          <React.Fragment key={index}>
            {/* Séparateur central */}
            {index === 3 && <View style={styles.separator} />}
            <View style={styles.box}>
              {loading ? (
                index === 0 ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : null
              ) : (
                <Text style={styles.digit}>{digit}</Text>
              )}
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Expiration */}
      {expiresLabel && (
        <Text style={styles.expires}>{expiresLabel}</Text>
      )}

      {/* Bouton regénérer */}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={onRefresh}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.refreshText}>
          {loading ? 'Génération…' : '↻  Nouveau code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  box: {
    width: 44,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#1A3A5C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  digit: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  separator: {
    width: 12,
    height: 2,
    backgroundColor: '#1A3A5C',
    borderRadius: 1,
    marginHorizontal: 2,
  },
  expires: {
    fontSize: 12,
    color: '#8A9BB0',
    marginTop: 4,
  },
  refreshButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A3A5C',
  },
  refreshText: {
    fontSize: 14,
    color: '#1A3A5C',
    fontWeight: '600',
  },
});
