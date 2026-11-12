# Audit de sécurité · SalleLibre

Grille : OWASP Top 10 : 2025 (contrôle d'accès d'abord).
Périmètre : `src/http/`, `src/services/`, `src/repositories/`, `src/config/`.
Méthode : revue statique du code, puis un test rouge par faille (`src/tests/security/`).

## Failles, classées par criticité

| # | Criticité | Catégorie OWASP | Faille | Preuve (requête ou scénario) | Correctif | Statut |
|---|---|---|---|---|---|---|
| F1 | Haute | A06 Insecure Design | Double réservation : vérification de chevauchement et écriture non atomiques | `POST /api/bookings` ×2 en parallèle, même salle et même créneau : les deux répondent 201 | Verrou par salle dans `BookingService` | Corrigée, test `src/tests/security/booking-race.test.ts` |
| F2 | Haute | A07 Authentication Failures | Aucune limite de tentatives sur `/auth/login` : brute force illimité | 50 × `POST /api/auth/login` avec mauvais mot de passe : toujours 401, jamais 429 | Compteur d'échecs par IP + nom (`src/http/login-limiter.ts`) : 429 après 5 échecs, 15 min | Corrigée, test `login-rate-limit.test.ts` |
| F3 | Moyenne | A06 Insecure Design (consommation de ressources) | Entrées sans borne de taille ni de nombre | `POST /api/rooms` avec 10 000 équipements ou un nom de 1 Mo (dans la limite de 100 ko du parseur JSON) : 201 | Bornes Zod : nom 100, équipements 20 × 50, sujet 200, mot de passe 128, nom d'utilisateur 64 | Corrigée, test `input-limits.test.ts` |
| F4 | Basse | A07 Authentication Failures (énumération) | Inscription : 409 « Ce nom d'utilisateur existe déjà » révèle les comptes existants. Le login a un écart de temps (pas de scrypt si le compte est inconnu) | `POST /api/auth/register` avec un nom existant : 409, donc le nom est confirmé | Non corrigée : un message générique à l'inscription impose une vérification par courriel, hors périmètre de l'API fictive | Risque accepté, à réévaluer si l'API sort du cadre pédagogique |

## Contrôles vérifiés et conformes

- Contrôle d'accès à l'annulation : `DELETE /api/bookings/:id` renvoie 403 pour un membre qui n'est pas propriétaire (test existant, `api.test.ts`, `bookings-scenarios.test.ts`).
- Contrôle d'accès aux salles : création, modification et suppression réservées aux admins (403 sinon).
- Rôle à l'inscription : `POST /auth/register` force `membre`, un admin ne peut pas être créé par l'API.
- Mots de passe : hachés en scrypt avec sel aléatoire, comparaison en temps constant, jamais renvoyés (test existant).
- JWT : secret obligatoire depuis l'environnement (16 caractères minimum), aucun secret en dur. Le rôle est relu en base à chaque requête.
- Erreurs : une erreur inattendue renvoie 500 « Erreur interne », sans stack trace.

## Constats informatifs

- `/docs` et `/openapi.json` sont publics. C'est voulu pour la documentation ; à restreindre en production.
- Pas de révocation de jeton : un JWT reste valable jusqu'à son expiration (1 h par défaut). Acceptable pour ce projet, à noter.
- Le verrou de F1 et le compteur de F2 vivent en mémoire d'un seul processus. Avec plusieurs instances ou une base partagée, il faut une transaction ou un stockage partagé (Redis, par exemple).

## Ce que cet audit ne garantit pas

Une revue manuelle, même outillée, n'est pas exhaustive. Un scanner (CodeQL, Semgrep) reste nécessaire pour compléter la couverture.
