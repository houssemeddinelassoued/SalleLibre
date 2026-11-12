---
applyTo: "src/tests/**"
---
# Règles de test · SalleLibre

- Framework : Vitest (`vitest run`), HTTP via Supertest. Pas d'autre lib de test.
- Nommage : `<unité>.test.ts`, placé dans le dossier miroir de `src/` (`src/tests/services/booking-service.test.ts`).
- Un `describe` par unité, un `it` par règle. Libellé en français, qui énonce la règle : « refuse un créneau qui chevauche ».
- Structure Arrange / Act / Assert, séparée par une ligne vide.
- Horloge fixe : injecter `now` (constante), jamais `new Date()` ni la vraie date du jour.
- Doubles aux frontières seulement (persistance, horloge). Ne jamais mocker le domaine (`src/domain/`).
- Assertions fortes : vérifier le type d'erreur ET le statut (`toBeInstanceOf(ConflictError)`, `status === 409`), pas seulement « ça lève une erreur ».
- Paramétrer avec `it.each` dès qu'il y a plus de deux cas pour une même règle.
- Ne jamais modifier `src/tests/acceptance/` (dossier intouchable).
- Ne jamais supprimer, sauter (`skip`) ou affaiblir un test existant pour faire passer la suite.
