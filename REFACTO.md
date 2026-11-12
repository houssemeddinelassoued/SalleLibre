# REFACTO · rapport d'anti-patterns (rôle Ask, aucune modification)

Périmètre : `src/domain/`, `src/services/`, `src/repositories/`, `src/http/`.
Base : commit `dea171a`, 90 tests verts, `tsc --noEmit` sans erreur.

## Priorisation : trois refactorings retenus

| # | Symptôme | Principe | Cible | Pourquoi maintenant |
|---|---|---|---|---|
| R1 | `findAvailableRooms` parcourt toutes les réservations pour chaque salle (`bookings.some` dans un `filter`) : coût O(salles × réservations). | Performance (complexité) | `src/domain/availability.ts` | Mesurable (`bench/availability.bench.ts`), et c'est la recherche la plus appelée. |
| R2 | `RoomService.create` et `RoomService.update` construisent le même objet `Room` (`equipment: input.equipment ?? []`), à deux endroits. | DRY, responsabilité unique | `src/services/room-service.ts` | Une évolution du modèle `Room` obligerait à modifier deux fois. |
| R3 | La règle « le début doit précéder la fin » est écrite à part dans `RoomService.findAvailable` et `BookingService.book`. | DRY | `src/services/` | Une seule source de vérité pour le message et la règle. |

Un refactoring par commit. Aucun ne modifie de test ni ne corrige de bug.

## Autres constats (non traités)

- **N+1 dans `RoomService.findAvailable`** : un appel `bookings.findByRoom` par salle. Corriger impose d'ajouter `findAll()` à `BookingRepository`, donc de changer une interface. C'est une décision d'architecture à part.
- **Vérification puis écriture non atomique dans `BookingService.book`** : le contrôle de chevauchement lit les réservations, puis enregistre. Deux requêtes concurrentes peuvent passer ensemble. Sans effet en mémoire mono-processus ; à traiter avec une vraie persistance.
- **Casts sur `res.locals`** (`res.locals.body as RoomBody`) dans `src/http/routes/index.ts` : le type n'est pas garanti par le middleware de validation. Faible risque (la validation passe avant), mais le compilateur ne protège pas.
- **Règles de validation en double** : `start < end` est contrôlé dans les schémas zod et dans les services. Voulu (défense en profondeur) ; à garder, à documenter, pas à supprimer.

## Ce qui est sain

- Dépendances dans le bon sens : `http → services → repositories (interfaces) → domain`.
- `domain/` pur, sans import externe, fonctions sans effet de bord.
- Erreurs métier typées (`AppError` et sous-classes), jamais d'`Error` générique dans les services.
