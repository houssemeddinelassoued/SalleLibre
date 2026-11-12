# SalleLibre · instructions pour Copilot
API REST FICTIVE de réservation de salles. Réponds en français, concis.
TypeScript strict, Node.js 22, Express, JWT, Vitest + Supertest.
Persistance en mémoire uniquement (pas de base de données).

## Architecture (voir PLAN.md)
- Dépendances : http → services → repositories (interfaces) → domain.
- domain/ pur : ni HTTP, ni stockage, aucun import externe.
- Routes fines : pas de règle métier, elles appellent un service.
- Les services dépendent des interfaces de repositories, jamais des Map.

## Erreurs métier (src/errors/, héritent de AppError)
- ValidationError → 400, UnauthorizedError → 401 (pas de jeton)
- ForbiddenError → 403 (mauvais rôle ou réservation d'autrui)
- NotFoundError → 404, ConflictError → 409 (chevauchement)
- Jamais d'Error générique. Format : { "message": "...", "details": ... }.

## Règles maison
- Aucune dépendance ajoutée sans mon accord (liste dans PLAN.md).
- Toute entrée (body, params, query) validée avant le service.
- Aucun secret dans le code : variables d'environnement.
- Mots de passe hachés (node:crypto scrypt), jamais renvoyés.
- Créneaux [début, fin[ : 10h–11h et 11h–12h ne se chevauchent pas.
- Pas de `any`, async/await, routes sous /api (ressources au pluriel).

## Tests
- Un test par règle métier ; un lot = ses tests + un commit.
- Ne jamais modifier src/tests/acceptance/.
- Modifications ciblées, sans changement hors sujet.
