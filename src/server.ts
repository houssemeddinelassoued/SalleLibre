import { createApp, buildServices } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const services = buildServices({
  jwtSecret: config.jwtSecret,
  tokenTtlSeconds: config.tokenTtlSeconds,
});

// Amorçage optionnel d'un administrateur (aucun mot de passe par défaut).
const { ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if (ADMIN_NAME && ADMIN_PASSWORD) {
  await services.auth.register(ADMIN_NAME, ADMIN_PASSWORD, 'admin');
}

createApp(services).listen(config.port, () => {
  console.log(`SalleLibre à l'écoute sur le port ${config.port}`);
});
