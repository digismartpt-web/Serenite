import React, { useEffect } from 'react';
import { Platform, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

// ─── Configuration des notifications push ────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

// ─── Schémas de deep link gérés ──────────────────────────────
//   serenite://join/[token]   → /invite/join?token=[token]
//   https://serenite.app/join/[token] → même destination (lien universel)

function extractJoinToken(url: string): string | null {
  // Gère les deux formes :
  //   serenite://join/abc123
  //   https://serenite.app/join/abc123
  const match = url.match(/\/join\/([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

export default function RootLayout() {
  const router = useRouter();

  // ── Gérer les deep links à l'ouverture de l'app ─────────────
  useEffect(() => {
    // L'app était fermée : récupérer l'URL initiale
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // L'app était en arrière-plan
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  function handleDeepLink(url: string) {
    const token = extractJoinToken(url);
    if (token) {
      // Naviguer vers l'écran join avec le token pré-rempli
      router.push(`/invite/join?token=${token}`);
    }
  }

  // ── Gérer les notifications reçues (tap) ─────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;

      if (data?.screen === 'invite/children') {
        router.push('/invite/children');
      } else if (data?.screen === 'home') {
        router.push('/(tabs)/home');
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        animation:    'slide_from_right',
        contentStyle: { backgroundColor: '#F7F9FC' },
      }}
    >
      {/* Onboarding */}
      <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />

      {/* Tunnel d'invitation */}
      <Stack.Screen name="invite"       options={{ headerShown: false }} />

      {/* Application principale */}
      <Stack.Screen name="(tabs)"       options={{ animation: 'fade' }} />
    </Stack>
  );
}
