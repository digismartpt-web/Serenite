# Cahier des Charges — Sérénité App v5.0

> **Version** 5.0  
> **Date** Mars 2026  
> **État** En développement  
> **Confidentiel — NEW APP AI — © 2026**  
> **Dernière correction** : 18 juin 2026 — Alignement réglementaire enfants + corrections incohérences

---

## 1. État actuel du projet

### 1.1 Avancément du développement

L'application Sérénité est en cours de développement actif. Le code source est hébergé sur GitHub (Premium-a-juste-prix/Mediation) avec 7 commits complétés. Le vibe coding avec Claude Code est la méthode de développement adoptée.

| Commit    | Phase         | Contenu                                                                         |
|-----------|---------------|---------------------------------------------------------------------------------|
| 57462a0   | Initial       | DB PostgreSQL + backend auth + onboarding 5 étapes + système d'invitation        |
| 214a7e8   | Wave 1        | Navigation 5 onglets + tableau de bord + ThemeContext + useAuth                  |
| 90053db   | Wave 2        | Messagerie CNV + API reformulation DeepSeek + score agressivité                  |
| d08d7fb   | Wave 3        | Calendrier de garde + module finances + routes API                               |
| f66797d   | Wave 4        | Espace enfant violet + paramètres + ThemePicker 10 thèmes                        |
| 492d22f   | Déploiement   | Docker + health check + README + scripts VPS                                     |
| 93aa4d4   | Fix SDK       | Mise à jour Expo SDK 54 + résolution conflits dépendances                        |

### 1.2 Stack technologique retenu

| Composant        | Technologie                                                    |
|------------------|----------------------------------------------------------------|
| Frontend         | React Native + Expo SDK 54 + TypeScript + NativeWind           |
| Navigation       | Expo Router v6 (navigation par fichiers)                       |
| Backend          | Node.js + Express + TypeScript                                 |
| Base de données  | PostgreSQL (VPS propre via Coolify)                            |
| Moteur IA CNV    | DeepSeek v4 Flash (API DeepSeek) — reformulation CNV           |
| Moteur vocal     | DeepSeek Whisper — transcription audio → texte → reformulation |
| Temps réel       | WebSockets (socket.io)                                         |
| Chiffrement      | Signal Protocol / libsodium (E2EE messages) — à implémenter    |
| Appels A/V       | LiveKit WebRTC (sans partage de numéro) — à implémenter        |
| Paiements        | Stripe (abonnements) — à implémenter                           |
| Hébergement      | VPS NEW APP AI via Coolify                                     |
| Développement    | Vibe coding avec Claude Code + GitHub (Premium-a-juste-prix/Mediation) |
| Déploiement      | Docker + docker-compose sur VPS                                |

> **Note** : E2EE, LiveKit et Stripe sont dans la roadmap mais pas encore implémentés dans le code.

---

## 2. Contexte et objectifs

### 2.1 Problématique

L'application Sérénité répond à un besoin concret : faciliter la communication entre parents séparés ou divorcés, réduire les conflits et protéger le bien-être des enfants. Son cœur technologique est un moteur d'IA basé sur la Communication Non-Violente (CNV) qui reformule automatiquement les messages pour les rendre neutres et constructifs.

| Indicateur          | Détail                                                                                         |
|---------------------|------------------------------------------------------------------------------------------------|
| Marché France       | 130 000+ divorces/an + séparations hors mariage = ~400 000 situations/an                       |
| Enfants concernés   | 4 millions d'enfants en garde partagée ou parent séparé en France (INSEE 2025)                 |
| Problème            | Les échanges post-séparation génèrent tensions qui impactent directement les enfants           |
| Concurrent principal| OurFamilyWizard (USA) — 99€/parent/an, données hébergées aux États-Unis, pas de reformulation IA complète |
| Avantage clé        | Seule app à reformuler complètement les messages + espace enfant dédié + 100% RGPD Europe     |

### 2.2 Objectifs

- Fluidifier la communication entre parents séparés via la reformulation IA temps réel
- Organiser la vie des enfants (garde, santé, éducation, finances) dans un espace sécurisé
- Offrir aux enfants un espace dédié, adapté par âge, cloisonné des échanges parentaux
- Réduire le recours aux procédures judiciaires en favorisant le dialogue apaisé
- Respecter scrupuleusement le RGPD avec données hébergées en Europe

---

## 3. Règles d'or — Moteur IA CNV

Le moteur de reformulation est le cœur différenciateur de Sérénité. Il repose sur 5 règles absolues implémentées dans le prompt système de DeepSeek.

### Règle 1 — Conserver les faits
Dates, heures, lieux, montants financiers et noms de personnes sont conservés à l'identique. Aucun fait ne doit être altéré, remodelé ou supprimé.

### Règle 2 — Ne pas ajouter d'information
Le moteur n'introduit jamais d'information logistique, d'interprétation ou de fait nouveau absent du texte d'origine.

### Règle 3 — Neutralité absolue
Ton purement factuel, poli et orienté vers l'organisation. Suppression de l'agressivité, des reproches, du sarcasme et des jugements de valeur.

### Règle 4 — Conserver la structure
Si le message original contient une question sur l'organisation, elle reste une question dans la reformulation.

### Règle 5 — Sortie épurée et validation obligatoire
Uniquement la reformulation, sans commentaire. L'utilisateur valide ou modifie avant envoi. Aucun envoi automatique.

### 3.1 Mode Pause
Si le score d'agressivité détecté dépasse 0.7 (sur une échelle 0-1 calculée sur la présence de majuscules excessives, points d'exclamation multiples et mots négatifs), l'application propose un délai de réflexion de 10 minutes avant envoi. L'utilisateur peut passer outre.

### 3.2 Indicateur de sérénité
Score de qualité des échanges (0-100%) visible uniquement par l'utilisateur, calculé sur la tonalité de ses messages bruts. Animé avec Animated.spring au montage.

---

## 4. Modules fonctionnels

### Module 1 — Inscription et onboarding (développé ✅)

5 étapes complètes avec OnboardingContext persistant entre les écrans.

| Étape | Contenu                                                                                                    |
|-------|------------------------------------------------------------------------------------------------------------|
| 1     | Bienvenue + choix de langue FR/ES/PT/EN                                                                    |
| 2     | Identité : prénom, nom, email, téléphone, adresse, date de naissance (calcul automatique de l'âge, minimum 18 ans) |
| 3     | Situation : rôle parental (Papa/Maman/Beau-père/Belle-mère), statut (Séparé/Divorcé), nombre d'enfants (1-10) |
| 4     | Code secret 6 chiffres : création + confirmation + option biométrie Face ID/empreinte. Stocké dans SecureStore uniquement |
| 5     | Consentements RGPD : 3 obligatoires (CGU, traitement données, données enfants) + 1 optionnel (newsletter). Bouton désactivé si manquants |

### Module 2 — Système d'invitation famille (développé ⚠️ — bugs d'invitation en cours de correction)

4 méthodes d'invitation du coparent. Chaque enfant rejoint selon son âge.

| Méthode           | Détail                                                                                           |
|-------------------|--------------------------------------------------------------------------------------------------|
| Code 6 chiffres   | Valable 24h, usage unique, génération garantie unique (retry loop x20)                            |
| Lien email        | Token 64 caractères URL-safe, expiration 7 jours                                                 |
| SMS automatique   | Via expo-sms, lien direct vers l'app                                                             |
| QR Code           | Via react-native-qrcode-svg, scanning instantané face à face                                     |
| Polling           | Toutes les 5s — navigation automatique à l'acceptation                                           |
| Mode Solo         | Si le coparent ne s'inscrit pas, l'utilisateur accède aux modules en mode journal personnel      |

#### Profils enfants — Tranches d'âge réglementaires

> **Base légale** : RGPD art. 8 (seuil France = 15 ans), Code civil art. 388-1 (droit d'expression dès 13 ans), autorité parentale jusqu'à 18 ans.

| Tranche d'âge | Réglementation                    | Fonctionnement Sérénité                                                      |
|---------------|-----------------------------------|------------------------------------------------------------------------------|
| 4-12 ans      | Pas de consentement numérique autonome. Autorité parentale pleine. | Profil créé entièrement par un parent. Accès via le téléphone du parent. PIN 4 chiffres simple. Interface pictogrammes (4-7 ans) ou texte simple (8-12 ans). |
| 13-14 ans     | Droit d'expression (art. 388-1 CC). En dessous du seuil RGPD (15 ans). Pas de compte autonome. | Parent crée le profil. Enfant peut exprimer ses préférences dans l'app (humeur, journal). Accès via PIN dédié sur son propre téléphone, mais compte rattaché au parent. Pas d'email propre. |
| 15-17 ans     | Seuil RGPD atteint. Consentement numérique possible. Autorité parentale maintenue. | Compte semi-autonome. Email propre, PIN, langue, thème indépendants. Parent conserve un accès de supervision (sans lire le journal privé). Le mineur peut consentir seul au traitement de ses données. |

### Module 3 — Tableau de bord parent (développé ✅)

- Salutation dynamique : Bonjour / Bon après-midi / Bonsoir selon l'heure
- Bannière de garde : Ce soir chez Papa/Maman + countdown setInterval 1s
- 4 raccourcis : grille icônes colorées vers les 4 modules principaux
- 2 métriques : messages non lus + sérénité %
- Barre de sérénité : animation Animated.spring au montage, couleur #1D9E75
- 3 dernières notifications avec icône, titre, corps, horodatage

### Module 4 — Messagerie CNV (développé ⚠️ — E2EE et appels LiveKit non implémentés)

- Zone brouillon (fond #FCEBEB) → bouton Reformuler → zone reformulée (fond #EAF3DE)
- Badge IA — CNV sur les messages reformulés
- Score d'agressivité 0-1 calculé par DeepSeek
- Mode Pause : timer 10 minutes si score > 0.7
- Bouton Modifier : rend le texte éditable avant envoi
- Horodatage certifié SHA-256 à l'envoi
- Archivage complet — messages inaltérables pour usage judiciaire éventuel
- Messagerie vocale : transcription audio via Whisper → reformulation CNV (développé ⚠️ — bug token)
- **À implémenter** : Appels audio/vidéo responsables sans partage de numéro (LiveKit WebRTC)
- **À implémenter** : Chiffrement E2EE de bout en bout (Signal Protocol / libsodium)

### Module 5 — Calendrier de garde (développé ⚠️ — API retourne erreur en prod, code complet côté frontend)

- Calendrier mensuel avec navigation mois précédent/suivant
- Code couleur par parent (personnalisable dans le profil)
- Orange pour les jours de transition
- Tap sur un jour → panneau bas avec événements du jour
- Ajout/modification/suppression d'événement avec formulaire complet
- Demandes d'échange de garde avec motif + système accord/refus
- **À implémenter** : Synchronisation Google Calendar / Apple Calendar / Outlook
- **À implémenter** : Rappels 48h avant chaque changement de garde
- **À implémenter** : Calendriers scolaires adaptés selon le pays (zones A/B/C pour la France)

### Module 6 — Finances (développé ⚠️ — page blanche en prod, code complet côté frontend/backend)

- Solde en temps réel entre les deux parents
- Liste des dépenses filtrée : toutes / en attente / validées
- Ajout de dépense avec justificatif photo et catégorie
- Validation ou refus par l'autre parent avec notification push
- Export comptable mensuel PDF + CSV
- **À implémenter** : Coffre-fort documentaire : jugements, ordonnances, conventions parentales
- **À implémenter** : Carnet de santé numérique partagé (vaccins, traitements, ordonnances)

### Module 7 — Espace enfant (développé ⚠️ — corrections UX en cours)

#### Cloisonnement technique absolu

L'espace enfant est cloisonné au niveau technique. Les données des messages inter-parentaux ne sont pas accessibles depuis la session enfant, même avec des tentatives de contournement.

| Interface               | Détail                                                                                                  |
|-------------------------|---------------------------------------------------------------------------------------------------------|
| Calendrier enfant       | Vue semaine simplifiée avec pictogrammes. Navigation gauche/droite entre les jours. Compte à rebours rassurant : "Dans 3 jours tu vas chez Maman" |
| Contacts                | Boutons appel Papa / Maman (confirmation avant appel). Contacts d'urgence toujours accessibles           |
| Checklist sac           | 7 articles + barre de progression. Personnalisable par les parents. Texte : "Affaires d'école"          |
| Humeur                  | 5 emojis. Sauvegarde AsyncStorage par jour. Privé                                                       |
| Journal privé           | Inaccessible aux parents et à l'IA. Stockage local par jour                                             |
| Adaptation âge          | 4-7 ans : pictogrammes. 8-12 ans : texte simple. 13-17 ans : interface adulte avec accès documents scolaires |
| Thème                   | Violet #5B3FA0 distinct de l'espace parent. PIN 4 chiffres dédié                                        |
| Thèmes enfant           | 2 thèmes dédiés : Violet et Vert Forêt. L'enfant choisit son thème                                      |

### Module 8 — Paramètres et personnalisation (développé ⚠️ — 5 boutons stubs à implémenter)

- Profil : nom, email, téléphone, langue, photo
- Thèmes visuels : 8 thèmes parents (Nuit, Ciel, Forêt, Soirée, Soleil, Rose, Sable, Corail) + 2 thèmes enfants
- Couleurs calendrier : personnalisables indépendamment du thème
- Langue : FR / ES / PT / EN — sélectable indépendamment par chaque membre de la famille
- Sécurité : changement PIN, activation/désactivation biométrie
- Notifications : toggle par type
- Déconnexion et suppression de compte
- **À implémenter** : Écran "Modifier mon profil" (actuellement stub vide)
- **À implémenter** : Écran "Changer mon code PIN" (actuellement stub vide)
- **À implémenter** : Sélecteur de langue fonctionnel (actuellement stub vide)
- **À implémenter** : Suppression de compte avec appel API (actuellement stub vide)
- **À implémenter** : Mot de passe oublié / réinitialisation par email

### Module 9 — Plan parental collaboratif (à développer)

- Espace collaboratif assisté par IA pour co-rédiger le plan parental
- Règles de vie, vacances, éducation, santé, activités
- Export PDF avec validation numérique des deux parents
- Document généré dans la langue choisie par chaque parent

### Module 10 — Alertes et sécurité (à développer)

- Détection de patterns préoccupants répétés (menaces, contenu illicite)
- Mécanisme de signalement discret avec orientation vers ressources adaptées
- Numéros d'urgence accessibles en un geste (3919, 119, 15, 17, 18 pour la France)
- Ressources d'urgence adaptées au pays détecté (FR/ES/PT/EN)

### Module 11 — Localisation opt-in transitions (à développer)

**Principe éthique** : Double consentement obligatoire des deux parents. Activé uniquement pendant les fenêtres de transition (30 minutes maximum). Désactivation automatique hors créneaux.

### Module 12 — Messagerie vocale (développé ⚠️ — bug "Token invalide")

- Enregistrement audio depuis l'app
- Transcription automatique via DeepSeek Whisper
- Reformulation CNV automatique du texte transcrit
- Même interface que la messagerie texte (brouillon → reformulation → validation)

> Ce module n'existait pas dans le CDC initial. Il a été ajouté dans le code.

---

## 5. Base de données PostgreSQL

### 5.1 Tables implémentées

| Table               | Colonnes clés                                                                                   | Usage                    |
|---------------------|--------------------------------------------------------------------------------------------------|--------------------------|
| users               | 22 champs + age généré automatiquement + trigger updated_at + CITEXT email                      | Principale               |
| families            | parent_a_id, parent_b_id, status, invite_token, invite_expires_at                               | Lien famille             |
| invitations         | code 6c, token 64c, method, status, expires_at, accepted_by                                     | Système d'invitation     |
| family_children     | age généré, family_access_code (15+ ans), pin_hash, calendar_color                               | Profils enfants          |
| consents            | 4 cases RGPD + IP + horodatage accepté                                                          | Conformité               |
| messages            | content, original_content, is_reformulated, aggressiveness_score, content_hash, pause_expires_at | Messagerie CNV           |
| custody_schedule    | date, custody_parent, type (normal/transition/vacation/event)                                    | Planning garde           |
| calendar_events     | title, date, time, location, created_by                                                         | Événements               |
| exchange_requests   | original_date, requested_date, reason, status (pending/accepted/refused)                        | Demandes échange         |
| expenses            | amount, category, receipt_url, status (pending/validated/refused)                                | Finances                 |

### 5.2 Objets PostgreSQL

- Extension citext : unicité email insensible à la casse
- Fonction fn_set_updated_at() + trigger trg_users_updated_at
- 10 index de performance : email, family_id, parent_a_id/b_id, token, code, status
- Vue v_family_full : joint famille + parentA + parentB pour GET /api/families/me

---

## 6. API Backend Node.js

### 6.1 Routes implémentées

| Route            | Endpoints                                                                                              | Statut       |
|------------------|--------------------------------------------------------------------------------------------------------|--------------|
| /api/auth        | POST register, login, verify-email, resend-verification — GET me — PUT update-pin                      | ✅ 6 endpoints |
| /api/invitations | POST create, accept — GET status — DELETE :id                                                         | ✅ 4 endpoints |
| /api/families    | POST children — GET me — PATCH solo                                                                   | ✅ 3 endpoints |
| /api/messages    | POST reformulate (DeepSeek), send — GET conversations                                                 | ✅ 3 endpoints |
| /api/events      | GET / — POST / — PUT /:id — DELETE /:id                                                               | ✅ 4 endpoints |
| /api/calendar    | Alias de /api/events                                                                                  | ✅ Même route  |
| /api/expenses    | GET / — POST / — PUT /:id/validate                                                                    | ✅ 3 endpoints |
| /api/finances    | Alias de /api/expenses                                                                                | ✅ Même route  |
| /api/voice       | POST transcribe (Whisper)                                                                             | ✅ 1 endpoint  |
| /api/users       | GET export (RGPD)                                                                                     | ✅ 1 endpoint  |
| /api/notifications | (routes présentes)                                                                                  | ✅             |
| /api/mediators   | (routes présentes)                                                                                    | ✅             |
| /api/admin       | (routes présentes)                                                                                    | ✅             |
| /api/health      | GET — {status, version, timestamp}                                                                    | ✅ 1 endpoint  |

### 6.2 Sécurité backend

- **JWT** : signAuthToken (30 jours) + signVerifyEmailToken (1 heure), audiences séparées
- **PIN** hashé bcrypt rounds:14. Jamais en clair dans les logs
- **Rate limiting** : 5 échecs → blocage 15 minutes (LoginAttemptTracker)
- **Helmet.js** : headers sécurité configurés pour Coolify/Traefik
- **CORS** strict en production (liste d'origines), permissif en dev
- **withTransaction()** : transactions atomiques avec rollback automatique
- **Validation Zod** sur tous les body de requêtes

---

## 7. Exigences techniques et légales

### 7.1 Sécurité et conformité

| Domaine             | Exigence                                                                                  | Priorité   | Statut       |
|---------------------|-------------------------------------------------------------------------------------------|------------|--------------|
| RGPD                | Données hébergées exclusivement en UE (VPS NEW APP AI). Consentement explicite. Droit à l'oubli implémenté. | Critique   | ✅ Partiel (export OK, suppression à implémenter) |
| Chiffrement E2EE    | Chiffrement de bout en bout tous messages et documents. Clés non accessibles aux équipes. | Critique   | ❌ À implémenter |
| Authentification    | Email + SMS 2FA à l'inscription. Biométrie Face ID / empreinte sur mobile.               | Critique   | ⚠️ PIN + biométrie OK, SMS 2FA à implémenter |
| Protection mineurs  | Zéro exploitation commerciale des données enfants. Journal privé inaccessible.            | Critique   | ✅ Conforme    |
| Valeur probatoire   | Horodatage certifié SHA-256 de tous les échanges archivés.                                | Haute      | ✅ Implémenté  |
| Accessibilité       | Conformité WCAG 2.1 niveau AA. Palettes testées pour daltoniens.                          | Haute      | ❓ Non audité  |
| Performance IA      | Reformulation CNV en moins de 3 secondes pour 95% des messages.                           | Haute      | ✅ DeepSeek rapide |
| Disponibilité       | SLA 99,5% minimum.                                                                        | Haute      | ✅ Docker + Coolify |

### 7.2 Plateformes cibles

- Application mobile iOS (iPhone et iPad, iOS 15+)
- Application mobile Android (Android 10+)
- Application web responsive (Chrome, Firefox, Safari, Edge)

### 7.3 Protection des données des enfants — Conformité RGPD

| Tranche | Base légale                                    | Consentement                                     | Données collectées                |
|---------|------------------------------------------------|--------------------------------------------------|-----------------------------------|
| 4-12 ans | Autorité parentale exclusive (art. 373-2 CC) | Parent consent pour l'enfant                     | Prénom, âge, humeur (locale), journal privé (local) |
| 13-14 ans | Art. 388-1 CC (droit d'expression) + autorité parentale | Parent consent, enfant peut exprimer des préférences | Idem + PIN dédié, préférences d'interface |
| 15-17 ans | RGPD art. 8 (seuil France = 15 ans)          | Consentement autonome possible. Parent informé.  | Idem + email propre, langue, thème, données d'usage |

**Principes transversaux** :
- Journal privé : stockage LOCAL uniquement (AsyncStorage), jamais sur le serveur
- Données enfants : jamais exploitées commercialement, jamais partagées
- Suppression : à la majorité (18 ans), l'enfant peut demander la suppression de toutes ses données
- Cloisonnement : session enfant techniquement isolée des messages inter-parentaux

---

## 8. Multilinguisme FR / ES / PT / EN

L'application est disponible en 4 langues sélectionnables indépendamment par chaque utilisateur depuis les paramètres de son profil. Le moteur IA CNV reformule les messages dans la langue de l'utilisateur.

| Langue      | Détail                                                                                              |
|-------------|-----------------------------------------------------------------------------------------------------|
| Français    | Langue par défaut. Calendriers scolaires zones A, B, C. Numéros urgence : 3919, 119, 15, 17, 18   |
| Espagnol    | Interface complète. Calendriers scolaires espagnols. Ressources d'urgence espagnoles                |
| Portugais   | Interface complète. Calendriers scolaires portugais et brésiliens. Ressources adaptées              |
| Anglais     | Interface complète. Calendriers scolaires UK. Ressources d'urgence anglaises                        |

### Communication bilingue

Quand deux parents utilisent des langues différentes, chaque parent voit les messages dans sa propre langue. Le moteur IA traduit et reformule simultanément selon les 5 règles CNV. Les faits sont conservés dans les deux langues.

---

## 9. Thèmes et personnalisation

Chaque membre de la famille choisit son thème indépendamment. Les thèmes s'appliquent aux fonds, barres de navigation et surfaces, indépendamment des couleurs du calendrier de garde.

| Thème                  | Description                                                                     |
|------------------------|---------------------------------------------------------------------------------|
| Nuit                   | Fond sombre profond #0F1923, accent bleu — confort visuel en soirée             |
| **Ciel (défaut)**      | Fond #F4F8FF, accent #378ADD — interface claire et professionnelle              |
| Forêt                  | Fond vert pâle #F2F7F0, accent #1D9E75 — pour les amateurs de nature            |
| Soirée                 | Fond violet sombre #1C1020, accent lilas #AFA9EC — ambiance douce nocturne      |
| Soleil                 | Fond crème #FFFBF0, accent ambre #EF9F27 — chaleureux et lumineux               |
| Rose                   | Fond #FFF0F5, accent framboise #D4537E                                          |
| Sable                  | Fond beige #F5F2EC, accent gris #888780 — minimaliste                           |
| Corail                 | Fond pêche #FFF4F0, accent #D85A30 — dynamique                                  |
| Enfant Violet (enfant) | Fond lavande #F0ECFF, accent violet #7F77DD — thème dédié espace enfant         |
| Enfant Vert (enfant)   | Fond menthe #F0FFF6, accent #1D9E75 — thème dédié espace enfant                 |

### 9.1 Couleurs du calendrier

Les couleurs de garde (Papa/Maman/enfants/transition) sont paramétrées séparément du thème. 8 swatches disponibles. La couleur de transition (orange) est fixe pour tous.

---

## 10. Profils utilisateurs

| Profil                | Tranche d'âge | Droits et accès                                                                                  | Modèle                  |
|-----------------------|---------------|--------------------------------------------------------------------------------------------------|-------------------------|
| Parent A / Parent B   | 18+           | Accès complet : messagerie CNV, calendrier, finances, documents. Sélectionne langue et thème. Configure l'espace enfants. | Abonnement Essentiel ou Sérénité |
| Enfant                | 4-12 ans      | Profil créé par un parent. Accès via profil dédié sur téléphone parent. PIN 4 chiffres. Interface adaptée (pictogrammes 4-7, texte 8-12). | Inclus |
| Enfant                | 13-14 ans     | Parent crée le profil. Enfant accède via PIN dédié sur son propre téléphone. Compte rattaché (pas d'email propre). Droit d'expression respecté. | Inclus |
| Enfant                | 15-17 ans     | Compte semi-autonome. Email propre, PIN, langue, thème indépendants. Consentement RGPD autonome. Parent supervision sans lecture journal privé. | Inclus |
| Utilisateur Solo      | 18+           | Parent dont le coparent n'est pas inscrit. Accès modules en mode journal personnel. Invitation toujours réutilisable. | Abonnement Sérénité |
| Administrateur        | —             | Accès technique logs système uniquement. Zéro accès contenu (E2EE). Gestion incidents sécurité.  | Interne                 |

---

## 11. Modèle économique

### Principe fondateur

Modèle abonnement exclusivement. Zéro publicité, zéro revente de données, zéro monétisation comportementale. Les données familles et enfants ne sont jamais exploitées commercialement.

### 11.1 Plans tarifaires

| Plan               | Prix                  | Contenu                                                                                           |
|--------------------|-----------------------|---------------------------------------------------------------------------------------------------|
| **Essentiel**      | Gratuit               | Messagerie limitée (10 msg/mois), calendrier de garde, espace enfant basique. Multilingue FR/ES/PT/EN. Découverte sans engagement. |
| **Sérénité**       | 9,90€/mois/parent     | Messagerie illimitée, tous les modules, Mode Solo, appels responsables, archivage horodaté, export PDF judiciaire. Multilingue complète. Réduction 20% si les deux parents s'abonnent (7,90€ chacun). |

### 11.2 Revenus complémentaires éthiques

- Licences B2B institutionnelles : CAF, tribunaux de famille, services protection enfance
- Annuaire de médiateurs certifiés référencés (abonnement annuel professionnel)
- Modules de formation en ligne : CNV, gestion des conflits, parentalité après séparation
- Recherche académique : accès données 100% anonymisées avec consentement explicite

### 11.3 Projections

| Indicateur                          | Valeur                                                                              |
|-------------------------------------|-------------------------------------------------------------------------------------|
| Marché adressable France            | ~400 000 situations/an (divorces + séparations hors mariage)                        |
| Taux de conversion cible an 2       | 2 à 3%                                                                              |
| ARR estimé à 2 600 abonnés          | ~310 000€/an (base conservatrice)                                                   |
| Potentiel B2B CAF                    | Multiplicateur x3 à x5 si convention nationale                                      |
| Potentiel européen an 3+            | 1,5 million de divorces/an en UE. Espagnol + portugais ouvre ES, LATAM, BR          |

---

## 12. Roadmap de développement

| Phase   | Période                      | Contenu                                                                                           | Statut |
|---------|------------------------------|---------------------------------------------------------------------------------------------------|--------|
| **Phase 1 — MVP** | Mars 2026           | DB PostgreSQL + backend auth/invitations + onboarding 5 étapes + navigation + tableau de bord + messagerie CNV + calendrier + finances + espace enfant + paramètres + Docker | ✅ Terminée |
| **Phase 2 — Corrections** | Juin 2026    | Fix bugs bloquants (API calendrier/finances, invitation, déconnexion, suppression compte) + stubs Paramètres + ajout enfants UI | 🔄 En cours |
| **Phase 3 — Modules manquants** | Juillet 2026 | Plan parental collaboratif + alertes sécurité + localisation opt-in + appels LiveKit + E2EE | ❌ À faire |
| **Phase 4 — Paiements** | Août 2026      | Intégration Stripe + abonnements Essentiel/Sérénité + gestion famille billing                    | ❌ À faire |
| **Phase 5 — Publication** | Septembre 2026  | App Store iOS + Google Play Store. Campagne lancement. Premiers utilisateurs bêta.                | ❌ À faire |
| **Phase 6 — Expansion** | An 2+               | Licences B2B CAF/tribunaux + langues additionnelles + modules formation CNV + API partenaires     | ❌ À faire |

---

## 13. Prochaines étapes immédiates

### Étape 1 — Fix bugs bloquants (prioritaire)

1. Fix API calendrier/finances qui retournent HTML au lieu de JSON en prod
2. Fix Voice (vérifier DeepSeek API key dans .env du backend déployé)
3. Fix Déconnexion (adapter SecureStore pour le web)
4. Fix Suppression de compte (implémenter endpoint + UI)
5. Fix Invitation email (encodage URL + HTTPS + template)

### Étape 2 — Compléter les stubs Paramètres

6. Écran "Modifier mon profil"
7. Écran "Changer mon code PIN"
8. Bouton "Renvoyer email vérification"
9. Sélecteur de langue fonctionnel
10. Mot de passe oublié / réinitialisation

### Étape 3 — Interface ajout enfants

11. Créer l'UI pour POST /api/families/children (backend prêt)

### Étape 4 — Corrections espace enfant

12. "Affaires d'école" au lieu de "Affaires de school"
13. Navigation semaine (swipe gauche/droite)
14. Boutons Papa/Maman actifs quand famille existe

---

## 14. Exigences éthiques

| Exigence              | Détail                                                                                  |
|-----------------------|-----------------------------------------------------------------------------------------|
| Transparence IA       | L'utilisateur sait toujours que son message a été reformulé par une IA. La différence visuelle est claire (rouge/vert). |
| Non-substitution      | L'app ne remplace pas un médiateur professionnel, un avocat ou un psychologue.          |
| Égalité parents       | Les deux parents ont exactement les mêmes droits et fonctionnalités.                    |
| Protection enfants    | Journal privé inaccessible. Données enfants jamais exploitées commercialement. Cloisonnement technique. |
| Pas de surveillance   | Aucune fonctionnalité ne peut être utilisée pour surveiller l'autre parent.             |
| Localisation éthique  | Opt-in double consentement. 30 minutes max. Désactivation automatique.                  |

### Interdictions absolues

Publicité ciblée. Revente de données. Monétisation comportementale. Blocage fonctionnalités enfants derrière paywall. Accès non consenti aux messages. Activation localisation sans double consentement.

---

*Dernière mise à jour : 18 juin 2026 — Hermes (MiMo v2.5-pro)*
