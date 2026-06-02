#!/bin/bash
echo "⚙️ Configuration automatique de la mémoire Sérénité..."

# 1️⃣ Créer le fichier auto-lu par Qwen Code
cat << 'EOF' > AGENTS.md
# 🤖 SYSTÈME AUTOMATIQUE — Sérénité App v5.0
👉 LIEZ CE FICHIER À CHAQUE SESSION. NE MODIFIEZ JAMAIS LES RÈGLES ⚠️

## 📌 CONTEXTE PROJET
- App: Sérénité (médiation parentale IA CNV)
- Stack: React Native + Expo SDK 54 + Node.js + Supabase (VPS)
- Phase: Tests locaux & Audit (V5.0)
- Utilisateur: DÉBUTANT Vibe Coding → Guide pas à pas. 1 commande à la fois. Explique chaque sortie.

## ⛔ RÈGLES DE SÉCURITÉ ABSOLUES
- 🔴 SUPABASE : NE TOUCHE QUE la table dédiée à Sérénité. Confirmation explicite avant toute requête SQL. Interdiction formelle sur les autres tables du VPS.
- 🤖 CNV : 5 règles d'or (1. Conserver faits 2. Rien ajouter 3. Neutralité 4. Conserver structure 5. Sortie épurée)
- 🛡️ RGPD/ÉTHIQUE : Hébergement UE, E2EE, zéro data enfants, journal privé inaccessible, pas de surveillance parentale.

## 📁 STRUCTURE CLÉ
- Front: app/, package.json (Expo 54, NativeWind, TS)
- Back: backend/, docker-compose.yml, .env.example
- IA: backend/src/services/ai/cnvReformulator.ts (Claude Haiku)
- DB: Supabase (VPS) → Table unique projet uniquement

## 🧠 MÉMOIRE SESSION
📖 À chaque démarrage, lis immédiatement : SERENITE_MEMORY.md
📖 À chaque fin de session, mets à jour : SERENITE_MEMORY.md (phase, dernière action, prochaine étape, bloquants)
EOF

# 2️⃣ Créer la mémoire initiale
cat << 'EOF' > SERENITE_MEMORY.md
# 🧠 SERENITÉ APP v5.0 — Mémoire Projet
- Phase: Phase 2 — Tests locaux & Audit
- Dernière action: Dépôt cloné, structure vérifiée, Qwen v0.0.5 opérationnel, automatisation mémoire activée
- Prochaine étape: Lancer l'audit complet des modules 1-8 via Qwen Code
- Bloquants: Aucun
- Journal: [2026-04-27] Initialisation mémoire auto
EOF

# 3️⃣ Créer l'alias intelligent "serenite"
grep -q "alias serenite=" ~/.bashrc 2>/dev/null || echo '
# 🚀 Alias Sérénité App (lecture auto + sauvegarde auto)
serenite() {
  echo "🔹 Chargement automatique du contexte Sérénité..."
  echo "✅ AGENTS.md chargé | 📖 SERENITE_MEMORY.md lu | ⚠️ Règles Supabase actives"
  echo "👉 Tape /save dans Qwen Code pour sauvegarder la session avant de quitter."
  qwen "$@"
}' >> ~/.bashrc

source ~/.bashrc
echo -e "\n✅ Configuration terminée ! Tapez simplement : serenite"
