---
applyTo: "src/http/**,src/services/**"
---
# Règles de sécurité · SalleLibre

Issues de `SECURITY-AUDIT.md`. Chaque règle a une faille d'origine et un test qui la garde.

- **Contrôle d'accès d'abord** : toute action sur une ressource vérifie que l'acteur en est propriétaire ou admin, dans le service, jamais seulement dans la route. Test : 403 pour un autre membre (test existant, `api.test.ts`).
- **Vérification puis écriture atomiques** : une règle d'unicité (créneau libre, nom unique) se vérifie et s'écrit dans la même section critique. Pour une salle : `withRoomLock`. Test : `src/tests/security/booking-race.test.ts` (F1).
- **Limiter les tentatives** : toute route d'authentification compte les échecs par IP + identifiant et renvoie 429 au-delà du seuil. Test : `login-rate-limit.test.ts` (F2).
- **Borner toute entrée** : chaque chaîne a un `.max()`, chaque liste un `.max()` sur son nombre d'éléments, dans le schéma Zod de `src/http/schemas/`. Test : `input-limits.test.ts` (F3).
- **Ne jamais renvoyer** de hash de mot de passe, de secret, ni de stack trace.
- **Aucun secret en dur** : passer par `loadConfig()` (variables d'environnement).
- **Aucune dépendance ajoutée** pour la sécurité sans accord (règle de `copilot-instructions.md`) : le limiteur est écrit à la main.

## Avant de corriger une faille

1. Écrire le test qui l'exploite, et le voir échouer (rouge).
2. Corriger au plus près de la cause.
3. Voir le test passer (vert), et la suite complète rester verte.
4. Mettre à jour `SECURITY-AUDIT.md`.
