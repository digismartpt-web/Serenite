/**
 * Limitation des tentatives de connexion (in-process).
 *
 * Seuil : 5 échecs consécutifs → blocage 15 minutes.
 *
 * NOTE : Cette implémentation fonctionne pour un déploiement
 * mono-instance sur Coolify. Pour du multi-instances, remplacer
 * par une implémentation Redis (ioredis + INCR + EXPIRE).
 */

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface Entry {
  count:        number;
  blockedUntil: number | null;
}

class LoginAttemptTracker {
  private readonly store = new Map<string, Entry>();

  /** Indique si l'email est actuellement bloqué. */
  isBlocked(email: string): boolean {
    const entry = this.store.get(this.key(email));
    if (!entry?.blockedUntil) return false;

    if (Date.now() > entry.blockedUntil) {
      this.store.delete(this.key(email));
      return false;
    }
    return true;
  }

  /** Durée restante du blocage en millisecondes (0 si non bloqué). */
  remainingMs(email: string): number {
    const entry = this.store.get(this.key(email));
    if (!entry?.blockedUntil) return 0;
    return Math.max(0, entry.blockedUntil - Date.now());
  }

  /** Enregistre un échec de connexion. Déclenche le blocage au 5e. */
  recordFailure(email: string): void {
    const k     = this.key(email);
    const entry = this.store.get(k) ?? { count: 0, blockedUntil: null };
    entry.count++;

    if (entry.count >= MAX_ATTEMPTS) {
      entry.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    }
    this.store.set(k, entry);
  }

  /** Réinitialise le compteur après une connexion réussie. */
  reset(email: string): void {
    this.store.delete(this.key(email));
  }

  /** Nombre de tentatives enregistrées (pour les messages d'erreur). */
  attemptsCount(email: string): number {
    return this.store.get(this.key(email))?.count ?? 0;
  }

  private key(email: string): string {
    // Normaliser pour éviter les contournements par casse
    return email.trim().toLowerCase();
  }
}

// Singleton partagé par l'ensemble de l'application
export const loginTracker = new LoginAttemptTracker();
