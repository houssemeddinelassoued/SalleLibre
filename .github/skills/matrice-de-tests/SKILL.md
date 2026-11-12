---
name: matrice-de-tests
description: Préparer ou compléter les tests de SalleLibre à partir d'une matrice de cas (nominal, limites, négatifs, sécurité), avant tout code de test. À utiliser dès qu'on demande de préparer, écrire, compléter ou couvrir des tests d'un service, d'une règle métier ou d'une route (ex. « prépare les tests de BookingService », « teste la réservation », « couvre les branches de RoomService »).
---
# Matrice de tests

1. Lis la règle métier (PLAN.md, `.github/copilot-instructions.md`) et le code concerné.
2. Remplis le modèle [CASES.modele.md](./CASES.modele.md) : 4 colonnes (Nominal, Limites, Négatifs, Sécurité), au moins 2 cas par colonne. Marque « ? » ce qui n'est pas tranché.
3. ARRÊTE-TOI : la matrice doit être validée par l'utilisateur avant tout test. Ne tranche jamais un « ? » toi-même.
4. Un test paramétré (`it.each`) par règle, une ligne de table par cas.
5. Ne supprime, ne saute et n'affaiblis jamais un test existant.
