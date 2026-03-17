import React, { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons }         from '@expo/vector-icons';
import * as SecureStore      from 'expo-secure-store';

import { ThemeProvider, useTheme } from '../context/ThemeContext';

const SECURE_TOKEN = 'serenite_auth_token';

// ─── Icône de tab avec badge ──────────────────────────────────

interface TabIconProps {
  name:    React.ComponentProps<typeof Ionicons>['name'];
  color:   string;
  size:    number;
  badge?:  number;
}

function TabIcon({ name, color, size, badge }: TabIconProps) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badge != null && badge > 0 && (
        <View style={{
          position:        'absolute',
          top:             -4,
          right:           -6,
          backgroundColor: '#E53E3E',
          borderRadius:    8,
          minWidth:        16,
          height:          16,
          justifyContent:  'center',
          alignItems:      'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800', lineHeight: 14 }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Contenu des tabs (utilise le thème) ─────────────────────

function TabsContent() {
  const router           = useRouter();
  const { theme }        = useTheme();
  const [unread, setUnread] = useState(0); // sera alimenté par Wave 2

  // ── Vérification JWT au montage ───────────────────────────
  useEffect(() => {
    SecureStore.getItemAsync(SECURE_TOKEN).then((token) => {
      if (!token) router.replace('/onboarding/step1');
    });
  }, []);

  const screenOpts = {
    headerShown:    false,
    tabBarStyle: {
      backgroundColor:  theme.tabBar,
      borderTopColor:   theme.border,
      borderTopWidth:   1,
      height:           Platform.OS === 'ios' ? 88 : 64,
      paddingBottom:    Platform.OS === 'ios' ? 28 : 10,
      paddingTop:       8,
      ...Platform.select({
        ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6 },
        android: { elevation: 8 },
      }),
    },
    tabBarActiveTintColor:   theme.tabBarActive,
    tabBarInactiveTintColor: theme.tabBarInactive,
    tabBarLabelStyle: {
      fontSize:   10,
      fontWeight: '600' as const,
      marginTop:  2,
    },
  };

  return (
    <Tabs screenOptions={screenOpts}>

      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              color={color}
              size={size}
              badge={unread}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'wallet' : 'wallet-outline'} color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />

    </Tabs>
  );
}

// ─── Layout racine avec ThemeProvider ────────────────────────

export default function TabsLayout() {
  return (
    <ThemeProvider>
      <TabsContent />
    </ThemeProvider>
  );
}
