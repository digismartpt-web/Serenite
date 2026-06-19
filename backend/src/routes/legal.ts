import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/legal/cgu - Conditions Generales d'Utilisation
router.get('/cgu', (req, res) => {
  try {
    const cguPath = path.join(__dirname, '../../../docs/CGU.md');
    const content = fs.readFileSync(cguPath, 'utf-8');
    res.json({ content, lastUpdated: '2026-06-19' });
  } catch (err) {
    console.error('[legal/cgu] Erreur lecture fichier:', err);
    res.status(500).json({ error: 'Document non disponible' });
  }
});

// GET /api/legal/confidentialite - Politique de Confidentialite
router.get('/confidentialite', (req, res) => {
  try {
    const confPath = path.join(__dirname, '../../../docs/CONFIDENTIALITE.md');
    const content = fs.readFileSync(confPath, 'utf-8');
    res.json({ content, lastUpdated: '2026-06-19' });
  } catch (err) {
    console.error('[legal/confidentialite] Erreur lecture fichier:', err);
    res.status(500).json({ error: 'Document non disponible' });
  }
});

export default router;
