# Sérénité — Comparatif Cahier des Charges vs Réalité

> **Date** : 18 juin 2026  
> **Source** : Scan code source + API backend + bundle JS déployé  
> **Fichiers analysés** : 22 fichiers backend TS, 28 fichiers frontend TSX, bundle JS (2.1 Mo)

---

## SYNTHÈSE EXÉCUTIVE

| Catégorie              | Conforme | Partiel | Non implémenté | Bug bloquant |
|------------------------|----------|---------|----------------|--------------|
| Modules fonctionnels   | 3        | 5       | 3              | 2            |
| Stack technologique    | 6        | 1       | 3              | 0            |
| Sécurité / RGPD        | 4        | 2       | 2              | 0            |
| UX / Navigation        | 2        | 3       | 1              | 3            |
| **TOTAL**              | **15**   | **11**  | **9**          | **5**        |

---

## 1. STACK TECHNOLOGIQUE — Écart CDC vs Réalité

| Technologie CDC         | Réalité code                              | Statut   |
|-------------------------|-------------------------------------------|----------|
| Claude Haiku (Anthropic) | **DeepSeek v4 Flash** (deepseekClient.ts) | ❌ DIFFÉRENT |
| Signal Protocol / libsodium | **Absent** du bundle JS et du code    | ❌ Non implémenté |
| LiveKit WebRTC          | 3 refs dans le bundle, 0 implémentation   | ❌ Non implémenté |
| Stripe                  | Refs dans le bundle, 0 intégration réelle | ❌ Non implémenté |
| WebSockets (socket.io)  | ✅ Présent dans le bundle (4 refs)        | ✅ OK    |
| Expo SDK 54             | ✅ Confirmé                               | ✅ OK    |
| NativeWind              | ✅ Confirmé                               | ✅ OK    |
| PostgreSQL              | ✅ Backend opérationnel                   | ✅ OK    |
| React Native + Expo     | ✅ Confirmé                               | ✅ OK    |
| Docker + Coolify        | ✅ Déployé                                | ✅ OK    |

### ⚠️ Point critique : Moteur IA

Le CDC spécifie **Claude Haiku (Anthropic)** mais le code utilise **DeepSeek v4 Flash**.
- `backend/src/services/ai/deepseekClient.ts` → `DEEPSEEK_API_URL`, `DEEPSEEK_MODEL`
- `.env.example` mentionne `ANTHROPIC_API_KEY` mais le code n'y accède jamais
- **Décision requise** : choisir l'un ou l'autre et aligner le code + config

---

## 2. MODULES FONCTIONNELS — Analyse détaillée

### Module 1 — Onboarding ✅ CONFORME
- 5 étapes : ✅ Fichiers step1.tsx à step5.tsx
- Choix langue FR/ES/PT/EN : ✅ Présent (mais drapeaux manquants visuellement — bug #5)
- Identité complète : ✅ Prénom, nom, email, téléphone, adresse, date naissance
- Code PIN 6 chiffres : ✅ SecureStore
- Consentements RGPD : ✅ 4 cases (3 obligatoires + 1 optionnel)

### Module 2 — Invitation famille ⚠️ PARTIEL
| Fonctionnalité          | Statut | Détail |
|-------------------------|--------|--------|
| Code 6 chiffres         | ✅     | Backend OK, frontend OK |
| Lien email              | ⚠️     | Envoi OK mais encodage cassé (`+` au lieu d'espaces) — bug #9 |
| SMS (expo-sms)          | ✅     | Import présent dans invite/send.tsx |
| QR Code                 | ✅     | react-native-qrcode-svg importé |
| Polling 5s              | ✅     | POLL_INTERVAL_MS = 5000 |
| Coparent ne peut pas se connecter | ❌ | Bug #9 — le lien d'invitation ne fonctionne pas |
| Mode Solo               | ⚠️     | Pas de gestion UI du mode solo sans coparent |
| Ajout enfants 4-11 ans  | ❌     | Backend POST /children existe mais **pas d'interface UI** pour l'utiliser |
| Ajout enfants 12-14 ans | ❌     | Même — pas d'UI |
| Ajout enfants 15-17 ans | ❌     | Même — pas d'UI |

### Module 3 — Tableau de bord ⚠️ PARTIEL
- Salutation dynamique : ✅
- Bannière de garde : ⚠️ Nécessite famille créée
- 4 raccourcis : ✅
- Métriques : ⚠️ Dépend des données
- Barre de sérénité : ⚠️ Dépend des messages

### Module 4 — Messagerie CNV ⚠️ PARTIEL
- Zone brouillon → Reformulation : ✅ Code présent
- Badge IA-CN V : ✅
- Score agressivité : ✅
- Mode Pause (score > 0.7) : ✅ Réfs trouvées (100 dans le bundle)
- Horodatage SHA-256 : ✅ Réfs trouvées (62)
- **Messagerie vocale** : ❌ Erreur "Token invalide" — bug #2
- **Appels audio/vidéo LiveKit** : ❌ Non implémenté (3 refs vides dans le bundle)
- **E2EE** : ❌ Non implémenté — les messages sont en clair

### Module 5 — Calendrier ⚠️ PARTIEL
- Calendrier mensuel : ✅ Code complet dans calendar.tsx (721 lignes)
- Code couleur par parent : ✅
- **Ajout d'événement** : ✅ Code présent (Modal + formulaire)
- **Modification/suppression** : ✅ Code présent
- **API events** : ⚠️ Route montée mais retourne HTML erreur en prod (problème déploiement)
- Synchronisation Google/Apple/Outlook : ❌ 1 seule ref dans le bundle, pas d'implémentation
- Rappels 48h : ❌ Pas d'implémentation notifications programmées
- Calendriers scolaires zones A/B/C : ❌ Non implémenté
- Demandes d'échange de garde : ✅ Backend exchange_requests table + route

### Module 6 — Finances ✅ CODE COMPLET, ❌ DÉPLOIEMENT CASSÉ
- Code frontend : ✅ 585 lignes, complet (solde, dépenses, catégories, validation)
- Code backend : ✅ Route expenses complète
- **Page blanche en prod** : ❌ Bug #1 — l'API /api/finances retourne HTML erreur au lieu de JSON
- Export PDF : ✅ Réfs dans le bundle (290)
- Export CSV : ✅ Réfs dans le bundle (14)
- Coffre-fort documentaire : ❌ Pas d'interface
- Carnet de santé : ❌ Pas d'interface

### Module 7 — Espace enfant ⚠️ PARTIEL
- Thème violet #5B3FA0 : ✅
- Calendrier semaine : ⚠️ Seulement le jour actuel — bug #13
- Contacts Papa/Maman : ⚠️ Boutons inactifs — bug #15
- Checklist sac : ✅ 7 articles
- Humeur (5 emojis) : ✅
- Journal privé : ✅ AsyncStorage local
- **"Affaires de school"** : ❌ Doit être "Affaires d'école" — bug #14
- **Tranches d'âge** : ❌ Non conformes au CDC (4-7, 8-12, 13-17) — bug #12
- Thème Vert Forêt enfant : ⚠️ Non vérifiable sans accès

### Module 8 — Paramètres ⚠️ PARTIEL (STUBS)
| Paramètre                | Statut | Détail |
|---------------------------|--------|--------|
| Thèmes (10)               | ✅     | 8 adultes + 2 enfants, fonctionnel |
| Mode affichage (Auto/Clair/Sombre) | ✅ | 3 modes |
| Notifications toggle      | ✅     | UI présente |
| **Modifier mon profil**   | ❌ STUB | `onPress={() => {}}` — vide |
| **Changer mon PIN**       | ❌ STUB | `onPress={() => {}}` — vide |
| **Changer langue**        | ❌ STUB | `onPress={() => {}}` — vide |
| **CGU**                   | ❌ STUB | `onPress={() => {}}` — vide |
| **Politique confidentialité** | ❌ STUB | `onPress={() => {}}` — vide |
| Export RGPD               | ⚠️     | Code présent mais dépend API /api/users/export |
| **Supprimer compte**      | ❌ STUB | Alert avec bouton "Annuler" seulement — pas d'action |
| **Déconnexion**           | ⚠️     | Code présent (SecureStore.delete) — peut ne pas marcher sur web |
| Email non vérifié         | ⚠️     | Badge affiché, bouton resend absent du UI |

### Module 9 — Plan parental collaboratif ❌ NON IMPLÉMENTÉ
- Aucun fichier trouvé
- Aucune route backend

### Module 10 — Alertes et sécurité ❌ NON IMPLÉMENTÉ
- Aucun fichier trouvé
- Numéros d'urgence non intégrés

### Module 11 — Localisation opt-in ❌ NON IMPLÉMENTÉ
- Aucun fichier trouvé

---

## 3. SÉCURITÉ & RGPD

| Exigence CDC              | Statut | Détail |
|---------------------------|--------|--------|
| Données hébergées UE      | ✅     | VPS NEW APP AI |
| E2EE messages             | ❌     | Non implémenté — messages en clair |
| PIN hashé bcrypt          | ✅     | bcrypt rounds:14 |
| Rate limiting             | ✅     | 5 échecs → blocage 15 min |
| Helmet.js                 | ✅     | Headers sécurité |
| JWT audiences séparées    | ✅     | signAuthToken + signVerifyEmailToken |
| Horodatage SHA-256        | ✅     | 62 refs dans le bundle |
| Validation Zod            | ✅     | Tous les body validés |
| **Password reset**        | ❌     | Absent du code |
| **Email verification resend** | ⚠️ | Backend OK (/api/auth/resend-verification) mais **pas de bouton UI** |
| **Suppression de compte** | ❌     | Alert stub, pas d'appel API |
| **Export RGPD fonctionnel** | ⚠️ | Code présent, non testé |
| WCAG 2.1 AA               | ❓     | Non vérifiable sans audit |
| SMS 2FA                   | ❌     | Non implémenté |
| Biométrie Face ID         | ⚠️     | 35 refs dans le bundle, SecureStore utilisé |

---

## 4. BUGS BLOQUANTS CONFIRMÉS PAR SCAN CODE

| # | Bug | Cause racine trouvée dans le code |
|---|-----|-----------------------------------|
| 1 | Finances page blanche | API /api/finances retourne HTML (pb routage reverse proxy) |
| 2 | Voice "Token invalide" | Route /api/voice/transcribe utilise DeepSeek — config API key manquante ou invalide |
| 3 | Déconnexion ne marche pas | `logout()` appelle `SecureStore.deleteItemAsync` — peut échouer sur web (pas de SecureStore natif) |
| 4 | Suppression compte HS | `onPress` affiche Alert avec "Annuler" UNIQUEMENT — pas de handler delete |
| 9 | Invitation email cassée | Mail envoyé avec encodage URL (`+` au lieu d'espaces) + lien IP brute pas HTTPS |
| 11 | Ajout enfants impossible | Backend `POST /children` existe mais **aucune UI** dans settings ni invite |

---

## 5. RECOMMANDATIONS — Priorisation

### 🔴 PRIORITÉ 1 — Bloquants (à faire immédiatement)

| # | Action | Effort estimé | Impact |
|---|--------|---------------|--------|
| 1 | **Fix API routes calendrier/finances** — Vérifier pourquoi /api/finances et /api/calendar retournent HTML au lieu de JSON en prod | 1h | Critique — 2 modules inaccessibles |
| 2 | **Fix Voice** — Vérifier DeepSeek API key dans .env du backend déployé | 30min | Critique — messagerie vocale HS |
| 3 | **Fix Déconnexion** — Remplacer SecureStore par AsyncStorage pour le web, ou utiliser un adapter | 2h | Critique — impossible de se déconnecter |
| 4 | **Fix Suppression compte** — Implémenter l'appel API + endpoint backend DELETE /api/users/me | 3h | Critique — exigence RGPD |
| 5 | **Fix Invitation email** — Corriger l'encodage URL + passer en HTTPS + améliorer le template | 2h | Critique — coparent ne peut pas rejoindre |

### 🟠 PRIORITÉ 2 — Fonctionnel (à faire cette semaine)

| # | Action | Effort estimé | Impact |
|---|--------|---------------|--------|
| 6 | **UI Ajout enfants** — Créer l'interface dans settings pour POST /api/families/children | 4h | Important — famille incomplète |
| 7 | **Bouton "Renvoyer email vérification"** — UI pour /api/auth/resend-verification | 1h | Important |
| 8 | **Stub "Modifier mon profil"** — Créer l'écran d'édition (nom, prénom, téléphone, photo) | 4h | Important |
| 9 | **Stub "Changer PIN"** — Écran de changement avec vérification ancien PIN | 3h | Important |
| 10 | **Password reset** — Endpoint + page de réinitialisation par email | 4h | Important |
| 11 | **Drapeaux pays onboarding** — Ajouter les emojis drapeaux FR/ES/PT/GB | 30min | Important |

### 🟡 PRIORITÉ 3 — UX / Contenu (à faire ce mois)

| # | Action | Effort estimé | Impact |
|---|--------|---------------|--------|
| 12 | **Espace enfant "Affaires d'école"** — Correction texte | 5min | Moyen |
| 13 | **Navigation semaine enfant** — Ajouter swipe gauche/droite | 2h | Moyen |
| 14 | **Tranches d'âge conformes** — Ajuster 4-7, 8-12, 13-17 | 2h | Moyen |
| 15 | **Boutons Papa/Maman** — Activer quand famille existe | 1h | Moyen |
| 16 | **CGU + Politique confidentialité** — Rédiger les documents | 4h | Nécessaire |
| 17 | **Mode Solo** — Vérifier que tous les modules fonctionnent sans coparent | 3h | Important |

### 🔵 PRIORITÉ 4 — Fonctionnalités manquantes (roadmap)

| # | Fonctionnalité | Effort estimé | CDC |
|---|----------------|---------------|-----|
| 18 | **E2EE messages** (Signal/libsodium) | 2-3 semaines | Critique CDC |
| 19 | **LiveKit appels audio/vidéo** | 1-2 semaines | Haute CDC |
| 20 | **Stripe abonnements** | 1 semaine | Haute CDC |
| 21 | **Plan parental collaboratif** (Module 9) | 2 semaines | Phase 4 |
| 22 | **Alertes et sécurité** (Module 10) | 1 semaine | Phase 4 |
| 23 | **Localisation opt-in** (Module 11) | 1 semaine | Phase 4 |
| 24 | **Synchronisation calendrier** (Google/Apple/Outlook) | 1 semaine | Haute CDC |
| 25 | **Communication bilingue** (traduction auto) | 1 semaine | Haute CDC |
| 26 | **Calendriers scolaires** zones A/B/C | 3 jours | Moyenne CDC |

---

## 6. INCOHÉRENCES CODE vs CDC vs .ENV

| Élément                  | CDC dit           | Code fait         | .env.example dit  |
|--------------------------|-------------------|-------------------|--------------------|
| Moteur IA                | Claude Haiku      | DeepSeek v4 Flash | ANTHROPIC_API_KEY  |
| Chiffrement              | Signal/libsodium  | Rien              | —                  |
| Appels A/V               | LiveKit WebRTC    | Rien              | —                  |
| Paiements                | Stripe            | Rien              | —                  |
| Base données             | PostgreSQL        | PostgreSQL ✅     | DB_HOST etc.       |

---

*Fichier généré le 18 juin 2026 — Hermes (MiMo v2.5-pro)*
