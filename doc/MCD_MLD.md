# Modèle de données — Nestor Vocal

## MCD / MLD (notation Mermaid ERD)

> Reconstitué à partir du schéma réellement observé en base (colonnes
> confirmées via `DESCRIBE`, requêtes `INSERT`/`SELECT` du code). Si tes
> vrais types diffèrent légèrement (ex. `VARCHAR(255)` vs `TEXT`), ajuste —
> la structure et les relations, elles, sont fiables.

```mermaid
erDiagram
    USERS ||--o{ APPOINTMENTS : "prend"
    USERS ||--o{ TICKETS : "réserve"
    USERS ||--o{ DOCUMENTS : "possède"
    USERS ||--o{ NOTIFICATIONS : "reçoit"
    USERS ||--o{ WAITLIST : "s'inscrit"
    USERS ||--o{ CHAT_MESSAGES : "échange"

    USERS {
        int id PK
        varchar name
        varchar email UK
        varchar phone
        varchar avatar
        varchar password_hash
        varchar google_id
        boolean blocked
        boolean notifyEmail
        boolean notifyPush
        varchar reset_token
        datetime reset_token_expires
        timestamp created_at
    }

    ADMINS {
        int id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        enum role "admin | superadmin"
        datetime last_login
        timestamp created_at
    }

    APPOINTMENTS {
        int id PK
        int userId FK
        varchar title
        text description
        datetime dateTime
        varchar location
        varchar agent
        int quantity
        enum status "upcoming | completed | cancelled"
        timestamp created_at
    }

    TICKETS {
        int id PK
        int userId FK
        varchar flightNumber
        varchar airline
        varchar origin
        varchar destination
        datetime departureDate
        datetime arrivalDate
        decimal price
        varchar currency
        enum status "upcoming | completed | cancelled"
        timestamp created_at
    }

    DOCUMENTS {
        int id PK
        int userId FK
        varchar name
        varchar file_path
        int file_size
        varchar mime_type
        date expires_at
        boolean sent_by_admin
        timestamp created_at
    }

    NOTIFICATIONS {
        int id PK
        int userId FK
        enum type "info | success | warning | error"
        enum category "appointment | ticket | document | system"
        text message
        boolean is_read
        timestamp created_at
    }

    WAITLIST {
        int id PK
        int userId FK
        varchar name
        date date
        int quantity
        timestamp created_at
    }

    CHAT_MESSAGES {
        int id PK
        int userId FK
        enum role "user | assistant"
        text content
        timestamp created_at
    }
```

## Règles de gestion

- Un utilisateur (`USERS`) peut avoir **0 à N** rendez-vous, billets, documents,
  notifications, inscriptions en liste d'attente et messages de conversation.
- `ADMINS` est une table **totalement séparée** de `USERS` — pas de relation
  directe, deux systèmes d'authentification distincts (JWT différents :
  `JWT_SECRET` vs `ADMIN_JWT_SECRET`).
- `WAITLIST.date` + `WAITLIST.userId` doivent être **uniques ensemble**
  (un utilisateur ne peut s'inscrire qu'une fois par jour) — voir
  `joinWaitlist()` dans `appointments.ts`, qui vérifie ça applicativement.
  Il serait plus robuste de l'imposer aussi en base (voir
  `constraints.sql`).
- `APPOINTMENTS.dateTime` doit être **unique parmi les rendez-vous au statut
  `upcoming`** (un seul rendez-vous par créneau) — actuellement vérifié
  uniquement côté application (`assertSlotAvailable()`), pas en base.
- `TICKETS.status`, `APPOINTMENTS.status` partagent les mêmes valeurs
  possibles (`upcoming`/`completed`/`cancelled`) mais sont deux colonnes
  indépendantes, pas de table de référence commune.

## Normalisation

Le schéma est en **3NF** : chaque table ne dépend que de sa clé primaire
(pas de dépendance transitive), pas de données répétées entre tables — les
seules redondances contrôlées sont les `userName` calculés par `JOIN` dans
les requêtes admin (`admin.ts`), jamais stockés physiquement.
