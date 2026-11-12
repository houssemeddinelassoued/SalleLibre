export interface AppConfig {
  readonly port: number;
  readonly jwtSecret: string;
  readonly tokenTtlSeconds: number;
}

/** Lit la configuration depuis l'environnement. Aucun secret par défaut. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET est requis (16 caractères minimum)');
  }
  const port = Number(env.PORT ?? 3000);
  const tokenTtlSeconds = Number(env.TOKEN_TTL_SECONDS ?? 3600);
  if (!Number.isInteger(port) || port < 1) throw new Error('PORT invalide');
  if (!Number.isInteger(tokenTtlSeconds) || tokenTtlSeconds < 1) {
    throw new Error('TOKEN_TTL_SECONDS invalide');
  }
  return { port, jwtSecret, tokenTtlSeconds };
}
