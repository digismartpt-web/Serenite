# 📋 Cahier des Charges — Sérénité App v5.0

*Document créé le 2 juin 2026 — Source : Brigitte*

---

**Application Sérénité — Version 5.0**

Application de médiation parentale avec IA de Communication Non-Violente.

| Champ | Valeur |
|-------|--------|
| Version | 5.0 |
| Date | Mars 2026 |
| État | En développement |

---

## 1. État actuel du projet

### 1.1 Avancement du développement

L'application Sérénité est en cours de développement actif. Le code source est hébergé sur GitHub (Premium-a-juste-prix/Mediation) avec 7 commits complétés. Le vibe coding avec Claude Code est la méthode de développement adoptée.

| Commit | Phase | Contenu |
|--------|-------|---------|
| Commit 57462a0 | Initial commit | DB PostgreSQL + backend auth + onboarding 5 étapes + système d'invitation |
| Commit 214a7e8 | Wave 1 | Navigation 5 onglets + tableau de bord + ThemeContext + useAuth |
| Commit 90053db | Wave 2 | Messagerie CNV + API reformulation Claude Haiku + score agressivité |
| Commit d08d7fb | Wave 3 | Calendrier de garde + module finances + routes API |
| Commit f66797d | Wave 4 | Espace enfant violet + paramètres + ThemePicker 10 thèmes |
| Commit 492d22f | Déploiement | Docker + health check + README + scripts VPS |
| Commit 93aa4d4 | Fix SDK | Mise à jour Expo SDK 54 + résolution conflits dépendances |

### 1.2 Stack technologique retenu

| Composant | Technologie |
|-----------|-------------|
| Frontend | React Native + Expo SDK 54 + TypeScript + NativeWind |
| Navigation | Expo Router v6 (navigation par fichiers) |
| Backend | Node.js + Express + TypeScript |
| Base de données | PostgreSQL (VPS propre via Coolify) |
| Moteur IA CNV | DeepSeek v4 Flash (remplace Claude Haiku depuis migration juin 2026) |
| Temps réel | WebSockets (socket.io) |
| Chiffrement | Signal Protocol / libsodium (E2EE messages) |
| Appels A/V | LiveKit WebRTC (sans partage de numéro) |
| Paiements | Stripe (abonnements) |
| Hébergement | VPS NEW APP AI via Coolify |
| Développement | Vibe coding avec Claude Code + GitHub (Premium-a-juste-prix/Mediation) |
| Déploiement | Docker + docker-compose sur VPS |

---

## 2. Contexte et objectifs

### 2.1 Problématique

L'application Sérénité répond à un besoin concret : faciliter la communication entre parents séparés ou divorcés, réduire les conflits et protéger le bien-être des enfants. Son cœur technologique est un moteur d'IA basé sur la Communication Non-Violente (CNV) qui reformule automatiquement les messages pour les rendre neutres et constructifs.

| Indicateur | Détail |
|------------|--------|
| Marché France | 130 000+ divorces/an + séparations hors mariage = ~400 000 situations/an |
| Enfants concernés | 4 millions d'enfants en garde partagée ou parent séparé en France (INSEE 2025) |
| Problème | Les échanges post-séparation génèrent tensions qui impactent directement les enfants |
| Concurrent principal | OurFamilyWizard (USA) — 99€/parent/an, données hébergées aux États-Unis, pas de reformulation IA complète |
| Avantage clé | Seule app à reformuler complètement les messages + espace enfant dédié + 100% RGPD Europe |

### 2.2 Objectifs

- Fluidifier la communication entre parents séparés via la reformulation IA temps réel
- Organiser la vie des enfants (garde, santé, éducation, finances) dans un espace sécurisé
- Offrir aux enfants un espace dédié, adapté par âge, cloisonné des échanges parentaux
- Réduire le recours aux procédures judiciaires en favorisant le dialogue apaisé
- Respecter scrupuleusement le RGPD avec données hébergées en Europe

---

## 3. Règles d'or — Moteur IA CNV

Le moteur de reformulation est le cœur différenciateur de Sérénité. Il repose sur 5 règles absolues implémentées dans le prompt système (DeepSeek v4 Flash).

**Règle 1 — Conserver les faits**
Dates, heures, lieux, montants financiers et noms de personnes sont conservés à l'identique. Aucun fait ne doit être altéré, remodelé ou supprimé.

**Règle 2 — Ne pas ajouter d'information**
Le moteur n'introduit jamais d'information logistique, d'interprétation ou de fait nouveau absent du texte d'origine.

**Règle 3 — Neutralité absolue**
Ton purement factuel, poli et orienté vers l'organisation. Suppression de l'agressivité, des reproches, du sarcasme et des jugements de valeur.

**Règle 4 — Conserver la structure**
Si le message original contient une question sur l'organisation, elle reste une question dans la reformulation.

**Règle 5 — Sortie épurée et validation obligatoire**
Uniquement la reformulation, sans commentaire. L'utilisateur valide ou modifie avant envoi. Aucun envoi automatique.

### 3.1 Mode Pause

Si le score d'agressivité détecté dépasse 0.7 (sur une échelle 0-1 calculée sur la présence de majuscules excessives, points d'exclamation multiples et mots négatifs), l'application propose un délai de réflexion de 10 minutes avant envoi. L'utilisateur peut passer outre.

### 3.2 Indicateur de sérénité

Score de qualité des échanges (0-100%) visible uniquement par l'utilisateur, calculé sur la tonalité de ses messages bruts. Animé avec Animated.spring au montage.

---

## 4. Modules fonctionnels

### Module 1 — Inscription et onboarding ✅

5 étapes complètes avec OnboardingContext persistant entre les écrans.

| Étape | Contenu |
|-------|---------|
| Étape 1 | Bienvenue + choix de langue FR/ES/PT/EN |
| Étape 2 | Identité : prénom, nom, email, téléphone, adresse, date de naissance (calcul auto âge, min 18 ans) |
| Étape 3 | Situation : rôle parental, statut, nombre d'enfants |
| Étape 4 | Code secret 6 chiffres + option biométrie. Stocké SecureStore uniquement |
| Étape 5 | Consentements RGPD : 3 obligatoires + 1 optionnel |

### Module 2 — Système d'invitation famille ✅

| Méthode | Description |
|---------|-------------|
| Code 6 chiffres | Valable 24h, usage unique |
| Lien email | Token 64 chars URL-safe, expiration 7 jours |
| SMS automatique | Via expo-sms, lien direct vers l'app |
| QR Code | Scanning instantané face à face |
| Polling | Toutes les 5s — navigation automatique à l'acceptation |
| Mode Solo | Si coparent absent — mode journal personnel |

Tranches d'âge enfants : 4-11 ans (profil parent + PIN), 12-14 ans (semi-autonome), 15-17 ans (compte autonome).

### Module 3 — Tableau de bord parent ✅

- Salutation dynamique (Bonjour / Bon après-midi / Bonsoir)
- Bannière de garde avec countdown
- 4 raccourcis vers modules principaux
- Messages non lus + sérénité %
- Barre de sérénité animée (Animated.spring, couleur #1D9E75)
- 3 dernières notifications

### Module 4 — Messagerie CNV ✅

- Zone brouillon (fond #FCEBEB) → Reformuler → zone reformulée (fond #EAF3DE)
- Badge IA—CNV sur messages reformulés
- Score d'agressivité + Mode Pause 10 min
- Hash SHA-256 à l'envoi
- Archivage inaltérable pour usage judiciaire
- Appels audio/vidéo sans partage de numéro (LiveKit WebRTC)

### Module 5 — Calendrier de garde ✅

- Mensuel, code couleur par parent
- Demandes d'échange avec motif + accord/refus
- Synchronisation Google/Apple/Outlook
- Rappels 48h
- Calendriers scolaires par pays/zones

### Module 6 — Finances ✅

- Solde temps réel
- Dépenses avec justificatif photo + catégorie
- Validation/refus avec notification push
- Export PDF + CSV
- Coffre-fort documentaire (jugements, ordonnances)
- Carnet de santé numérique

### Module 7 — Espace enfant ✅

- Cloisonnement technique absolu (données parents inaccessibles)
- Thème violet #5B3FA0
- Calendrier semaine simplifié + countdown rassurant
- Boutons appel Papa/Maman
- Checklist sac personnalisable
- Humeur 5 emojis (privé)
- Journal privé (inaccessible aux parents et à l'IA)
- Adaptation par âge : 4-7 ans (pictos), 8-12 ans (texte), 13-17 ans (adulte)

### Module 8 — Paramètres et personnalisation ✅

- Profil complet
- 10 thèmes visuels (8 parents + 2 enfants)
- Couleurs calendrier personnalisables
- 4 langues (FR/ES/PT/EN)
- Sécurité (PIN, biométrie)
- Notifications par type
- Suppression de compte

### Module 9 — Plan parental collaboratif 🔲

Espace collaboratif assisté par IA pour co-rédiger le plan parental. Export PDF.

### Module 10 — Alertes et sécurité 🔲

Détection patterns préoccupants, signalement discret, numéros d'urgence.

### Module 11 — Localisation opt-in transitions 🔲

Double consentement obligatoire, 30 min max, désactivation automatique.

---

## 5. Base de données PostgreSQL

### 5.1 Tables implémentées

| Table | Colonnes clés | Usage |
|-------|--------------|-------|
| users | 22 champs + age auto + trigger updated_at + CITEXT email | Principale |
| families | parent_a_id, parent_b_id, status, invite_token | Lien famille |
| invitations | code 6c, token 64c, method, status | Système d'invitation |
| family_children | age généré, family_access_code, pin_hash | Profils enfants |
| consents | 4 cases RGPD + IP + horodatage | Conformité |
| messages | content, original_content, is_reformulated, score, hash | Messagerie CNV |
| custody_schedule | date, parent, type | Planning garde |
| calendar_events | title, date, time, location, created_by | Événements |
| exchange_requests | original_date, requested_date, reason, status | Demandes échange |
| expenses | amount, category, receipt_url, status | Finances |

### 5.2 Objets PostgreSQL

- Extension citext
- Fonction fn_set_updated_at() + trigger
- 10 index de performance
- Vue v_family_full

---

## 6. API Backend Node.js

### 6.1 Routes implémentées

| Route | Endpoints |
|-------|-----------|
| /api/auth | POST register, login, verify-email — GET me — PUT update-pin |
| /api/invitations | POST create, accept — GET status — DELETE :id |
| /api/families | POST children — GET me — PATCH solo |
| /api/messages | POST reformulate (DeepSeek v4 Flash), send — GET conversations |
| /api/calendar | GET :year/:month — POST events, exchange-request — PUT respond |
| /api/finances | GET balance, expenses — POST expenses — PUT :id/validate |
| /api/health | GET — {status, version, timestamp} |

### 6.2 Sécurité backend

- JWT (30 jours + 1 heure, audiences séparées)
- PIN hashé bcrypt rounds:12
- Rate limiting : 5 échecs → 15 min blocage
- Helmet.js + CORS strict (prod)
- Transactions atomiques withTransaction()
- Validation Zod sur tous les body

---

## 7. Exigences techniques et légales

| Domaine | Exigence | Priorité |
|---------|----------|----------|
| RGPD | Données UE uniquement. Consentement explicite. Droit à l'oubli | Critique |
| Chiffrement E2EE | Messages et documents. Clés non accessibles aux équipes | Critique |
| Authentification | Email + 2FA. Biométrie mobile | Critique |
| Protection mineurs | Zéro exploitation données enfants. Journal privé inaccessible | Critique |
| Valeur probatoire | Horodatage SHA-256 de tous les échanges | Haute |
| Accessibilité | WCAG 2.1 AA. Palettes testées daltoniens | Haute |
| Performance IA | Reformulation < 3 secondes pour 95% des messages | Haute |
| Disponibilité | SLA 99,5% minimum | Haute |

---

## 8. Multilinguisme FR / ES / PT / EN

4 langues sélectionnables indépendamment par utilisateur. Le moteur IA reformule dans la langue de l'utilisateur.

**Communication bilingue :** quand deux parents utilisent des langues différentes, chaque parent voit les messages reformulés dans sa propre langue (traduction + CNV simultanées).

---

## 9. Thèmes et personnalisation

| Thème | Fond | Usage |
|-------|------|-------|
| Nuit | #0F1923, accent bleu | Soirée |
| Ciel (défaut) | #F4F8FF, accent #378ADD | Interface claire |
| Forêt | #F2F7F0, accent #1D9E75 | Nature |
| Soirée | #1C1020, accent lilas | Ambiance douce |
| Soleil | #FFFBF0, accent ambre | Lumineux |
| Rose | #FFF0F5, accent framboise | Doux |
| Sable | #F5F2EC, accent gris | Minimaliste |
| Corail | #FFF4F0, accent dynamique | Dynamique |
| Violet (enfant) | #F0ECFF, accent #7F77DD | Espace enfant |
| Vert (enfant) | #F0FFF6, accent #1D9E75 | Espace enfant |

---

## 10. Profils utilisateurs

| Profil | Accès |
|--------|-------|
| Parent A/B | Complet : messagerie CNV, calendrier, finances, documents |
| Enfant 4-11 ans | Via téléphone parent, PIN 4 chiffres, pictogrammes |
| Enfant 12-14 ans | Semi-autonome, lien d'activation |
| Enfant 15-17 ans | Compte autonome complet |
| Solo | Mode journal personnel |
| Administrateur | Logs système uniquement (E2EE = zéro contenu) |

---

## 11. Modèle économique

### 11.1 Plans tarifaires

| Plan | Prix | Contenu |
|------|------|---------|
| Essentiel | Gratuit | 10 msg/mois, calendrier, espace enfant basique, multilingue |
| Sérénité | 9,90€/mois/parent | Illimité, tous modules, appel, archivage, export PDF. Réduction 20% pour deux parents (7,90€) |

### 11.2 Revenus complémentaires

- Licences B2B : CAF, tribunaux, protection enfance
- Annuaire médiateurs certifiés
- Formation en ligne CNV
- Recherche académique (données anonymisées)

### 11.3 Projections

- Marché France : ~400 000 situations/an
- Taux conversion an 2 : 2-3%
- ARR ~310 000€/an à 2 600 abonnés
- Potentiel B2B : x3 à x5 via CAF
- Potentiel UE an 3+ : 1,5M divorces/an

---

## 12. Roadmap

| Phase | Période | Contenu |
|-------|---------|---------|
| Phase 1 — MVP ✅ | Mars 2026 | DB + auth + onboarding + messagerie CNV + calendrier + finances + espace enfant + Docker |
| Phase 2 — Tests 🔄 | En cours | Tests Android/iOS, correction bugs, validation parcours |
| Phase 3 — Déploiement VPS | À faire | .env production, docker-compose up, health check |
| Phase 4 — Modules manquants | Mai 2026 | Plan parental, alertes, localisation, journal photos, LiveKit |
| Phase 5 — Publication | Juin 2026 | App Store + Google Play, campagne lancement |
| Phase 6 — Expansion | An 2+ | B2B, langues additionnelles, formation CNV, API |

---

## 13. Prochaines étapes immédiates (mise à jour)

*Mise à jour au 2 juin 2026 — état réel sur le VPS :*

- [x] **Migration DeepSeek** : code backend modifié pour DeepSeek v4 Flash (au lieu de Claude Haiku)
- [x] **Base de données** : schéma `sereno` créé sur Supabase PG, données de test chargées
- [x] **Backend Docker** : image construite et conteneur lancé sur le port 3000
- [ ] **APK Android** : compilation à lancer (en cours)
- [ ] **Déploiement Coolify** : à configurer
- [ ] **Tests Android/iOS** : à faire après APK

---

## 14. Exigences éthiques

- **Transparence IA** : l'utilisateur sait toujours que son message a été reformulé par une IA
- **Non-substitution** : l'app ne remplace pas un médiateur, avocat ou psychologue
- **Égalité parents** : mêmes droits et fonctionnalités pour les deux parents
- **Protection enfants** : journal privé inaccessible, données jamais exploitées
- **Pas de surveillance** : aucune fonction pour surveiller l'autre parent
- **Localisation éthique** : double consentement, 30 min max, désactivation auto

**Interdictions absolues :** publicité ciblée, revente de données, monétisation comportementale, blocage fonctionnalités enfants derrière paywall, accès non consenti aux messages, activation localisation sans double consentement.
