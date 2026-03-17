import { Stack } from 'expo-router';

export default function InviteLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle:      { backgroundColor: '#F7F9FC' },
        headerTintColor:  '#1A3A5C',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerBackTitle:  'Retour',
        contentStyle:     { backgroundColor: '#F7F9FC' },
      }}
    >
      <Stack.Screen
        name="send"
        options={{ title: 'Inviter le coparent' }}
      />
      <Stack.Screen
        name="join"
        options={{ title: 'Rejoindre la famille' }}
      />
      <Stack.Screen
        name="children"
        options={{
          title: 'Ajouter les enfants',
          headerBackVisible: false,   // étape obligatoire, pas de retour
        }}
      />
    </Stack>
  );
}
