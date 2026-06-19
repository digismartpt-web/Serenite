# Sérénité — Incohérences entre les 3 documents — RÉSOLUES

> **Date** : 18 juin 2026  
> **Statut** : Les 9 incohérences ont été traitées. Ce fichier sert d'archive.

---

## INCOHÉRENCE 1 — Tranches d'âge ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| CDC Module 2 : 4-11, 12-14, 15-17       | Toutes les tranches alignées sur 4-12, 13-14, 15-17 |
| CDC Module 7 : 4-7, 8-12, 13-17         | Sous-tranches interface : 4-7 (picto), 8-12 (texte), 13-17 (adulte) |
| CDC §10 : 4-11, 12-14, 15-17            | 4-12, 13-14, 15-17 avec base légale                  |
| Bugs #12 : "Attendu 4-7, 8-12, 13-17"   | Corrigé avec réglementation (RGPD art.8, CC art.388-1) |

**Base légale ajoutée au CDC** : RGPD art. 8 (seuil France = 15 ans), Code civil art. 388-1 (droit d'expression dès 13 ans), autorité parentale jusqu'à 18 ans.

---

## INCOHÉRENCE 2 — Messagerie vocale ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| CDC : pas de mention                     | Ajouté comme Module 12 dans le CDC                   |
| Bugs #2 : symptôme sans cause            | Cause racine ajoutée (JWT ou DeepSeek API key)       |

---

## INCOHÉRENCE 3 — Calendrier "pas d'interface" ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| Bugs #6 : "Pas d'interface pour ajouter" | Corrigé : "Le code est complet (721 lignes). L'API retourne HTML en prod." |
| CDC : "développé ✅"                      | Corrigé : "développé ⚠️ — API retourne erreur en prod" |

---

## INCOHÉRENCE 4 — CGU/Confidentialité stubs vides ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| CDC : "développé ✅"                      | Corrigé : "développé ⚠️ — 5 boutons stubs à implémenter" |
| Bugs #16-18 : "Documents manquants"      | Cause racine ajoutée (stub vide + pas de page web)   |

---

## INCOHÉRENCE 5 — Diagnostic Voice ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| Bugs #2 : "Token invalide" sans diagnostic | Ajouté : "JWT expiré OU clé DeepSeek manquante" + note CDC corrigé |

---

## INCOHÉRENCE 6 — Routes API incomplètes ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| CDC : 7 routes listées                   | CDC corrigé : 14 routes listées (ajout voice, notifications, mediators, admin, etc.) |
| Bugs : ne mentionnait pas les routes manquantes | Ajouté section "Fonctionnalités CDC non implémentées" (#23-#35) |

---

## INCOHÉRENCE 7 — Statuts "développé ✅" abusifs ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| CDC : 8 modules marqués "développé ✅"   | Seul Module 1 reste "✅". Les 7 autres sont "⚠️" avec explication. |

---

## INCOHÉRENCE 8 — Bugs ne couvre pas les manques CDC ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| Bugs : 19 items, rien sur E2EE/LiveKit/etc. | Ajouté section "Fonctionnalités CDC non implémentées" avec 13 items (#23-#35) |

---

## INCOHÉRENCE 9 — Moteur IA ✅ RÉSOLUE

| Avant                                    | Après (corrigé)                                      |
|------------------------------------------|------------------------------------------------------|
| CDC : "Claude Haiku (Anthropic)"         | Corrigé : "DeepSeek v4 Flash"                        |
| .env.example : "ANTHROPIC_API_KEY"       | Note ajoutée dans le CDC                             |
| Code : "deepseekClient.ts"               | Cohérent avec le CDC corrigé                         |

---

*Fichier archivé le 18 juin 2026 — Toutes les incohérences résolues*
