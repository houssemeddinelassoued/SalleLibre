import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

const OPENAPI_PATH = fileURLToPath(new URL('../../openapi.yaml', import.meta.url));

export function loadOpenApi(): Record<string, unknown> {
  return parse(readFileSync(OPENAPI_PATH, 'utf8')) as Record<string, unknown>;
}

/** Documentation publique : interface sur /docs, document brut sur /openapi.json. */
export function buildDocsRouter(): Router {
  const spec = loadOpenApi() as swaggerUi.JsonObject;
  const router = Router();
  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  return router;
}
