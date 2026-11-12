# Matrice de cas · BookingService

Règle métier : une réservation est refusée si le créneau est invalide, dans le passé, sans sujet, sur une salle inconnue, ou s'il chevauche une réservation existante (intervalles [début, fin[). Une annulation n'est permise qu'au propriétaire ou à un admin.
Source : src/services/booking-service.ts

| Nominal | Limites | Négatifs | Sécurité |
|---|---|---|---|
| Réserver une salle libre → renvoie la réservation (propriétaire = user) | Créneau 10h–11h après une réservation 11h–12h → accepté (fin exclue) | Début ≥ fin (10h–10h, 11h–10h) → 400 | Membre annule sa propre réservation → OK |
| Réserver après une réservation 9h–10h → accepté | Créneau 10h30–11h30 sur 10h–11h → 409 | Créneau commençant avant `now` → 400 | Membre annule la réservation d'autrui → 403 |
| Annuler sa réservation → supprimée | Créneau identique à une réservation existante → 409 | Sujet vide ou espaces seuls → 400 | Admin annule la réservation d'autrui → OK |
| Lister `listMine` → seulement ses réservations | Créneau qui commence exactement à `now` → ? (voir Q1) | Salle inconnue → 404 | Annulation d'une réservation inexistante → 404 |

## Décisions à trancher (« ? »)

- Q1 : un créneau qui commence exactement à `now` est-il accepté ? → **Oui.**
- Q2 : longueur maximale du sujet ? → **Pas de limite.**
- Q3 : salle inconnue ET créneau invalide → **400** (la validation passe avant la recherche de salle).
- Q4 : un admin peut-il réserver sur un créneau déjà pris ? → **Non** (409 pour tout le monde).

Statut : VALIDÉE par l'utilisateur (réponses Q1 à Q4 ci-dessus).
