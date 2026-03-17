/**
 * Compat shim — redirige vers lib/database.ts
 * Les routes existantes (invitations, families) importent depuis '../db',
 * ce fichier leur garantit une migration sans changement d'import.
 */
export { default, query, queryOne, withTransaction } from '../lib/database';
