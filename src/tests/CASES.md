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

# Matrice de cas · Liste d'attente

Règle métier : on peut s'inscrire en liste d'attente sur un créneau occupé (au moins un chevauchement avec une réservation). Quand une réservation est annulée, les entrées de la salle sont parcourues dans l'ordre d'inscription (FIFO) ; toute entrée dont le créneau est entièrement libre devient une réservation (règle gloutonne), les suivantes sont réévaluées. Intervalles [début, fin[.
Sources : src/domain/waitlist.ts, src/services/booking-service.ts

| Nominal | Limites | Négatifs | Sécurité |
|---|---|---|---|
| S'inscrire sur un créneau occupé → entrée (propriétaire = user) | Entrée 10h–11h, réservation 11h–12h annulée ou non : 10h–11h n'est pas occupé par elle (fin exclue) | Créneau libre → 409 | Membre retire l'entrée d'autrui → 403 |
| Annulation → le premier inscrit est promu, son entrée disparaît | Chevauchement partiel : inscription acceptée, promotion seulement si tout le créneau est libre | Début ≥ fin, passé, sujet vide → 400 | Admin retire l'entrée d'autrui → OK |
| Deux entrées disjointes libérées → les deux promues | Deux entrées qui se chevauchent → seule la première promue | Salle inconnue → 404 | Membre annule la réservation d'autrui → 403, aucune promotion |
| `listMyWaitlist` → seulement ses entrées | Début exactement égal à `now` → promu ; début < `now` → purgée | Propriétaire de la réservation → 409 ; doublon chevauchant → 409 ; 21ᵉ entrée → 409 | Entrée inexistante → 404 |

## Décisions

- Q1 : inscription sur créneau libre → **409** (il faut réserver).
- Q2 : chevauchement partiel → **autorisé**, promotion seulement quand tout le créneau est libre.
- Q3 : plusieurs promotions par annulation → **gloutonne**, dans l'ordre FIFO.
- Q4 : début passé → **purgée sans promotion** ; début = `now` → promu.
- Q5 : propriétaire d'une réservation sur le créneau → **409**.
- Q6 : doublon chevauchant une de ses entrées sur la salle → **409**.
- Q7 : plafond **20 entrées par utilisateur** → 409 au-delà.
- Q8 : pas de notification ; le promu consulte `GET /bookings/mine`.
- Q9 : pas de cascade à la suppression d'une salle ; la promotion ignore les salles inconnues.
- Q10 : l'admin s'inscrit comme un membre.
- Q11 : logique dans `BookingService` (4ᵉ paramètre optionnel `waitlist?`).
- Q12 : sans objet (`openapi.yaml` documente déjà la récurrence).

Statut : VALIDÉE par l'utilisateur (recommandations Q1 à Q12).
