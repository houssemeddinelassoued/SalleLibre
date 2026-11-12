---
name: refactoring-sur
description: Refactorer SalleLibre par petits gestes sûrs, sans changer le comportement, avec les tests comme preuve. À utiliser pour extraire, renommer, simplifier, dédoublonner ou optimiser un morceau de code (ex. « extrais la création de Room », « optimise findAvailableRooms »).
---
# Refactoring sûr

1. Nomme le symptôme, le principe SOLID ou DRY, et la cible (fichier, fonction). Un geste par demande.
2. Lance `npm test` et `npm run typecheck` : les deux doivent être verts avant de toucher au code.
3. Écris le geste le plus petit possible (extraire une fonction, remplacer une boucle par un `Set`, partager une règle).
4. Ne modifie jamais `src/tests/` ni un fichier `*.test.ts`. Un test à changer signale que le geste change le comportement : annule.
5. Relance les tests et le typecheck. Test rouge : annule le geste et explique pourquoi.
6. Pour une optimisation, mesure avant et après (`npx vitest bench --run`) et donne le chiffre.
7. Garde les mêmes messages d'erreur, les mêmes codes HTTP et le même ordre de vérification.
8. Pas de correction de bug pendant un refactoring : signale-le à part.
9. Pas de dépendance ajoutée.
10. Un commit par geste, message `refactor : <ce qui change>`, puis le diff résumé.
