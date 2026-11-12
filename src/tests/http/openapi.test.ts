import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildServices, createApp } from '../../app.js';
import { loadOpenApi } from '../../http/docs.js';
import { buildRouter } from '../../http/routes/index.js';

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
}

const services = buildServices({ jwtSecret: 'secret-de-test-assez-long', tokenTtlSeconds: 60 });

/** Opérations réellement déclarées dans Express, au format "METHODE /chemin/{id}". */
function declaredOperations(): string[] {
  const stack = buildRouter(services).stack as unknown as Layer[];
  return stack
    .filter((layer) => layer.route)
    .flatMap(({ route }) =>
      Object.keys(route!.methods).map(
        (m) => `${m.toUpperCase()} ${route!.path.replace(/:(\w+)/g, '{$1}')}`,
      ),
    )
    .sort();
}

/** Opérations décrites dans openapi.yaml. */
function documentedOperations(): string[] {
  const paths = loadOpenApi().paths as Record<string, Record<string, unknown>>;
  const verbs = ['get', 'post', 'put', 'patch', 'delete'];
  return Object.entries(paths)
    .flatMap(([path, item]) =>
      Object.keys(item).filter((k) => verbs.includes(k)).map((v) => `${v.toUpperCase()} ${path}`),
    )
    .sort();
}

describe('documentation OpenAPI', () => {
  it('décrit exactement les routes de l’API (ni oubli, ni route fantôme)', () => {
    expect(documentedOperations()).toEqual(declaredOperations());
  });

  it('chaque route protégée documente 401, et les routes admin documentent 403', () => {
    const paths = loadOpenApi().paths as Record<string, Record<string, { responses: Record<string, unknown>; security?: unknown[] }>>;
    for (const [path, item] of Object.entries(paths)) {
      for (const [verb, op] of Object.entries(item)) {
        if (!['get', 'post', 'put', 'delete'].includes(verb)) continue;
        const isPublic = Array.isArray(op.security) && op.security.length === 0;
        if (!isPublic) expect(op.responses, `${verb} ${path}`).toHaveProperty('401');
      }
    }
    const adminOps = [['/rooms', 'post'], ['/rooms/{id}', 'put'], ['/rooms/{id}', 'delete']] as const;
    for (const [path, verb] of adminOps) {
      expect(paths[path]?.[verb]?.responses).toHaveProperty('403');
    }
  });

  it('sert la documentation sans jeton', async () => {
    const app = createApp(services);
    const json = await request(app).get('/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toMatch(/^3\./);
    const ui = await request(app).get('/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger');
  });
});
