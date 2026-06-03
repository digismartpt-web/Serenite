import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';

interface Props {
  /** Nombre de cases — 6 pour invitation, 4 pour PIN enfant */
  length?: 4 | 6;
  onComplete: (code: string) => void;
  onChangeCode?: (code: string) => void;
  /** Pré-remplir (depuis deep link) */
  defaultValue?: string;
  /** Afficher des points au lieu des chiffres (mode PIN) */
  secure?: boolean;
  /** Désactiver pendant la validation */
  disabled?: boolean;
  /** Couleur de l'accentuation (bordure active) */
  accentColor?: string;
}

/**
 * CodeInput
 * Composant générique pour la saisie d'un code numérique.
 * - Auto-focus sur la case suivante après chaque chiffre
 * - Backspace revient à la case précédente et l'efface
 * - Clavier numérique natif
 * - Réutilisable pour PIN enfant (length=4) et code invitation (length=6)
 */
export default function CodeInput({
  length = 6,
  onComplete,
  onChangeCode,
  defaultValue = '',
  secure = false,
  disabled = false,
  accentColor = '#1A3A5C',
}: Props) {
  const [values, setValues] = useState<string[]>(() => {
    const initial = Array(length).fill('');
    defaultValue.split('').slice(0, length).forEach((c, i) => {
      initial[i] = c;
    });
    return initial;
  });

  const inputs = useRef<(TextInput | null)[]>(Array(length).fill(null));

  // Si une valeur par défaut est fournie (deep link), focus sur la dernière case vide
  useEffect(() => {
    if (defaultValue) {
      const firstEmpty = defaultValue.length < length ? defaultValue.length : length - 1;
      inputs.current[firstEmpty]?.focus();
    } else {
      inputs.current[0]?.focus();
    }
  }, []);

  // Notifier le parent à chaque changement
  useEffect(() => {
    const code = values.join('');
    onChangeCode?.(code);
    if (code.length === length && !values.some(v => v === '')) {
      onComplete(code);
    }
  }, [values]);

  function handleChange(text: string, index: number) {
    // On ne garde que le dernier chiffre saisi (cas copier-coller ignoré)
    const digit = text.replace(/\D/g, '').slice(-1);
    if (!digit) return;

    const next = [...values];
    next[index] = digit;
    setValues(next);

    // Avancer au case suivante
    if (index < length - 1) {
      inputs.current[index + 1]?.focus();
    } else {
      inputs.current[index]?.blur();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace') {
      const next = [...values];
      if (next[index]) {
        // Effacer la case courante
        next[index] = '';
        setValues(next);
      } else if (index > 0) {
        // Revenir à la case précédente et l'effacer
        next[index - 1] = '';
        setValues(next);
        inputs.current[index - 1]?.focus();
      }
    }
  }

  function handlePaste(index: number, text: string) {
    const digits = text.replace(/\D/g, '').slice(0, length);
    if (digits.length > 1) {
      const next = Array(length).fill('');
      digits.split('').forEach((d, i) => { next[i] = d; });
      setValues(next);
      const focusIndex = Math.min(digits.length, length - 1);
      inputs.current[focusIndex]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {values.map((val, index) => {
        const isFocused = false; // géré par le style natif
        return (
          <TextInput
            key={index}
            ref={(r) => { inputs.current[index] = r; }}
            style={[
              styles.box,
              val ? styles.boxFilled : styles.boxEmpty,
              { borderColor: val ? accentColor : '#CBD5E0' },
              disabled && styles.boxDisabled,
            ]}
            value={secure && val ? '•' : val}
            onChangeText={(t) => handleChange(t, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            onChange={(e) => {
              // Gestion du coller sur Android
              const text = e.nativeEvent.text ?? '';
              if (text.length > 1) handlePaste(index, text);
            }}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={!disabled}
            caretHidden
            textAlign="center"
            accessibilityLabel={`Chiffre ${index + 1} sur ${length}`}
          />
        );
      })}
    </View>
  );
}

export function CodeInputLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  box: {
    width: 46,
    height: 58,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: '700',
    color: '#1A3A5C',
    backgroundColor: '#F7F9FC',
    textAlign: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  boxEmpty: {
    backgroundColor: '#F7F9FC',
  },
  boxFilled: {
    backgroundColor: '#EEF2FF',
  },
  boxDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    color: '#4A5568',
    marginBottom: 12,
    textAlign: 'center',
  },
});
