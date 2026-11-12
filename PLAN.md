# PLAN · API SalleLibre (TP 2)

API REST fictive de réservation de salles. Persistance **en mémoire** (pas de base de données).
Statut : implémenté (auth, salles, réservations, récurrence). Feature en cours : liste d'attente (voir plus bas).

## Arborescence

```
src/
  domain/          Types et règles pures (overlap, availability). Ni HTTP ni stockage.
  errors/          Erreurs métier typées (AppError et sous-classes).
  repositories/    Interfaces de stockage + implémentations en mémoire (Map).
  services/        Règles métier : auth, salles, réservations.
  http/
    routes/        Routes fines : lisent la requête, appellent un service.
    middlewares/   authenticate (JWT), requireRole, validate, errorHandler.
    schemas/       Schémas de validation des entrées (zod).
  config/          Variables d'environnement (JWT_SECRET, durée du jeton).
  app.ts           Assemble Express, dépendances et routeur (sans listen).
  server.ts        Démarre le serveur.
  tests/           domain/, services/, http/, acceptance/ (intouchable)
openapi.yaml       Documentation de l'API, servie sur /docs
```

## Règle des dépendances

`http → services → repositories (interfaces) → domain`. `domain` n'importe rien.

## Erreurs métier

| Erreur | HTTP |
|---|---|
| ValidationError | 400 |
| UnauthorizedError | 401 |
| ForbiddenError | 403 |
| NotFoundError | 404 |
| ConflictError | 409 |

Toutes héritent de `AppError { status, message }`. Jamais d'`Error` générique.

## Interfaces à créer en premier

1. **Erreurs** : `AppError` et sous-classes.
2. **RoomRepository** : `findAll()`, `findById(id)`, `save(room)`, `delete(id)`.
3. **BookingRepository** : `findByRoom(roomId)`, `findByOwner(ownerId)`, `findById(id)`, `save(b)`, `delete(id)`.
4. **UserRepository** : `findByName(name)`, `findById(id)`, `save(user)`.
5. **RoomService** (création, modification, suppression : admin) : `list`, `create`, `update`, `remove`, `findAvailable(slot, minCapacity)`.
6. **BookingService** : `book(user, roomId, slot, subject)` (ConflictError si chevauchement), `cancel(user, bookingId)` (ForbiddenError si ni propriétaire ni admin), `listMine(user)`.
7. **AuthService** : `login(name, password)` → JWT, `verify(token)` → `User`.

## Ordre de livraison (un lot, ses tests, un commit)

1. Erreurs, puis repositories en mémoire.
2. Services + tests des règles métier (409 chevauchement, 403 rôle).
3. Routes, validation, authentification.
4. `openapi.yaml`.

## Décisions validées

- Dépendances autorisées : `express`, `jsonwebtoken`, `zod`, `supertest`, `swagger-ui-express`, `yaml` (+ types). Toute autre : accord préalable.
- Mots de passe hachés avec `node:crypto` (scrypt), sans bcrypt.
- Dossier `http/` regroupant routes, middlewares et schémas.

## Feature · Liste d'attente (décisions : `src/tests/CASES.md`)

- Domaine : `WaitlistEntry` (créneau + `id`, `roomId`, `ownerId`, `subject`, `createdAt`) et `selectPromotions` (fonction pure, FIFO, gloutonne) dans `domain/waitlist.ts`.
- Repository : `WaitlistRepository` : `findByRoom(roomId)` (ordre d'insertion), `findByOwner`, `findById`, `save`, `delete`.
- Service : `BookingService` reçoit un 4ᵉ paramètre optionnel `waitlist?`. `joinWaitlist`, `leaveWaitlist`, `listMyWaitlist`. `cancel` passe sous le verrou de salle et promeut les entrées ; sans repository d'attente, son comportement est inchangé.
- HTTP : `POST /api/waitlist`, `GET /api/waitlist/mine`, `DELETE /api/waitlist/{id}`, documentées dans `openapi.yaml`.
- Lots : 1 domaine, 2 stockage, 3a inscription/retrait/liste, 3b promotion à l'annulation, 4 HTTP + OpenAPI.
