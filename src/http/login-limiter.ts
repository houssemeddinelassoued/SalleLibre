export interface FailureLimiterOptions {
  /** Nombre d'échecs tolérés dans la fenêtre. */
  readonly maxFailures: number;
  readonly windowMs: number;
  /** Horloge injectée pour des tests déterministes. */
  readonly now?: () => number;
}

interface Attempts {
  count: number;
  windowStart: number;
}

/**
 * Compte les échecs de connexion par clé (ici : IP + nom). Au-delà du seuil,
 * la clé est bloquée jusqu'à la fin de la fenêtre. Un succès remet le compteur à zéro.
 * Mémoire en processus, comme le reste du stockage.
 */
export class FailureLimiter {
  private readonly attempts = new Map<string, Attempts>();
  private readonly now: () => number;

  constructor(private readonly options: FailureLimiterOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  isBlocked(key: string): boolean {
    const entry = this.current(key);
    return entry !== undefined && entry.count >= this.options.maxFailures;
  }

  recordFailure(key: string): void {
    const entry = this.current(key) ?? { count: 0, windowStart: this.now() };
    entry.count += 1;
    this.attempts.set(key, entry);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** Renvoie l'entrée si elle est dans sa fenêtre, sinon la supprime. */
  private current(key: string): Attempts | undefined {
    const entry = this.attempts.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.windowStart >= this.options.windowMs) {
      this.attempts.delete(key);
      return undefined;
    }
    return entry;
  }
}
