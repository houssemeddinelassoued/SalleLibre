
## SALLE LIBRE

Ce projet est une API de réservation de salles

Fonctions : 
- Vérifier la disponibilité des salles
- Réserver une salle
- Libérer une salle
- Consulter l'historique des réservations
- Réserver chaque semaine, avec des dates d'exception (série récurrente, tout ou rien)

## Réservation récurrente

`POST /api/bookings/recurring` crée une réservation par semaine, au même jour et à la même heure que le premier créneau, jusqu'au jour limite inclus. Les dates d'exception sont sautées.

```json
{
  "roomId": "…",
  "start": "2026-11-10T10:00:00.000Z",
  "end": "2026-11-10T11:00:00.000Z",
  "untilDay": "2026-12-01",
  "exceptions": ["2026-11-24"],
  "subject": "Point hebdo"
}
```

Réponse `201` : la liste des réservations créées (ici : 10 nov et 1er déc, le 24 nov étant sauté).

- Au plus 26 occurrences par série.
- Tout ou rien : si une seule occurrence est déjà prise, la réponse est `409` et aucune réservation n'est créée.
- Codes : `400` (entrée invalide), `401` (sans jeton), `404` (salle inconnue), `409` (conflit).

Documentation complète sur `/docs`.

Technologies utilisées :
- TypeScript (strict)
- Node.js 22
- Express
- JWT (JSON Web Token)
- Zod (validation), Vitest + Supertest (tests)

Persistance en mémoire uniquement (pas de base de données). 