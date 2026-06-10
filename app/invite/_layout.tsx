import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';

export default function InviteLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle:      { backgroundColor: '#F7F9FC' },
        headerTintColor:  '#1A3A5C',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerBackTitle:  t('back'),
        contentStyle:     { backgroundColor: '#F7F9FC' },
      }}
    >
      <Stack.Screen
        name="send"
        options={{ title: t('invite.inviteCoparent') }}
      />
      <Stack.Screen
        name="join"
        options={{ title: t('invite.title') }}
      />
      <Stack.Screen
        name="children"
        options={{
          title: t('invite.addChildren'),
          headerBackVisible: false,
        }}
      />
    </Stack>
  );
}
