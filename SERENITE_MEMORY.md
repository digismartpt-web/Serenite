# 🧠 SÉRÉNITÉ APP v5.0 — Mémoire Projet

- Phase: ✅ TOUS LES BUGS CORRIGÉS (19 juin 2026)
- Dernière action: Batch final 6 bugs corrigés + déployés
- Date mise à jour: 19 juin 2026, 17h30 (UTC+1)

---

## 📋 Tableau des bugs — Statut complet

| # | Bug | Description | Statut | Date correction |
|---|-----|-------------|--------|-----------------|
| #7 | Modifier profil | Modal d'édition (nom, prénom, email) | ✅ CORRIGÉ | 19/06 batch 1 |
| #8 | Email vérifié | Badge cliquable + resend verification | ✅ CORRIGÉ | 19/06 batch 1 |
| #9 | Invitation email | Lien domaine (plus IP brute) | ✅ CORRIGÉ | 19/06 batch 1 |
| #10 | QR Code post-scan | Écran « Rejoindre la famille » + boutons Créer compte / Se connecter | ✅ CORRIGÉ | 19/06 batch 2 |
| #11 | Ajout enfants UI | Bouton « Ajouter un enfant » dans settings → /invite/children | ✅ CORRIGÉ | 19/06 batch 2 |
| #12 | (réservé) | — | — | — |
| #13 | Langue | Modal sélecteur 4 langues + sync profil | ✅ CORRIGÉ | 19/06 batch 1 |
| #14 | PIN oublié | Backend forgot-pin + reset-pin + UI login complète | ✅ CORRIGÉ | 19/06 batch 2 |
| #15 | Mode solo | Comportement par défaut (famille status=solo) | ✅ VÉRIFIÉ | 19/06 batch 2 |
| #16 | Tranches âge | Code correct (4-7/8-12/13-17), adaptation UI par âge | ✅ DÉJÀ OK | — |
| #17 | Nav semaine | Boutons ← → pour naviguer semaines + label plage dates | ✅ CORRIGÉ | 19/06 batch 2 |
| #18 | Texte FR | « Affaires d'école » (corrigé i18n) | ✅ CORRIGÉ | 19/06 batch 1 |
| #19 | Appel Papa/Maman | Fetch numéros API famille + Linking.openURL(tel:) | ✅ CORRIGÉ | 19/06 batch 2 |
| #20 | CGU | Document rédigé + endpoint + Modal | ✅ CORRIGÉ | 19/06 batch 1 |
| #21 | Confidentialité | Document rédigé + endpoint + Modal | ✅ CORRIGÉ | 19/06 batch 1 |

**Score: 15/15 bugs traités — 0 ouvert**

---

## 🔧 Corrections bonus (19/06 batch 2)

- Fix SECURE_TOKEN_KEY dans login.tsx (était tronqué 'sereni...oken' → 'serenite_auth_token')
- i18n: 15 nouvelles clés FR/EN/ES/PT (forgot pin, add child, auth required)

---

## État des services (19/06 17h30)

- Backend (port 3000): ✅ EN LIGNE — systemctl active
- Frontend: ✅ DÉPLOYÉ — bundle entry-a3e63f... (2.19 MB)
- Site: https://serenite.newappai.com — ✅ HTTP 200

## Historique des batches

| Batch | Date | Bugs | Fichiers modifiés |
|-------|------|------|-------------------|
| batch 1 | 19/06 | #7, #8, #9, #13, #18, #20, #21 | settings.tsx, login.tsx, translations.ts, CGU.md, CONFIDENTIALITE.md |
| batch 2 | 19/06 | #10, #11, #14, #15, #16, #17, #19 | child/home.tsx, invite/join.tsx, settings.tsx, auth.ts (backend), jwt.ts, mailer.ts, translations.ts |

## Compte test
- brigitte@test.com / 123456
