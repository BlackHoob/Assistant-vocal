# Nestor Vocal

An AI-powered voice concierge for **Selectour Alltour**, a French travel agency. Nestor Vocal lets clients search and book flights, manage appointments, and exchange documents with the agency — either through a traditional web UI or by talking to an AI assistant (Nestor) that calls the same backend functions on their behalf.

## Overview

- **Client app**: search flights, book appointments (with a waitlist system for full days), upload/receive travel documents, chat with Nestor by voice or text, in 8 languages (French, English, Arabic, Spanish, Portuguese, Dioula, Bambara, Wolof).
- **Admin panel**: dashboard with real-time stats and charts, user management (edit/block/delete), appointment and ticket oversight (list + weekly waitlist view), document exchange, broadcast messaging, admin account management.
- **Voice assistant (Nestor)**: powered by Groq (LLaMA 3.3 70B) with function calling — Nestor never invents a result; every flight search, booking, or appointment goes through the exact same backend functions the REST API uses.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, react-i18next, React Router |
| Backend | Node.js, Express, TypeScript, MySQL (`mysql2`) |
| AI / Voice | Groq (LLaMA 3.3 70B, function calling), ElevenLabs (speech-to-text) |
| Flights | Duffel API (real-time search & pricing) |
| Auth | JWT (separate secrets for client and admin), Google OAuth 2.0, bcrypt |
| Email | Nodemailer (password reset), with a console-log fallback when SMTP isn't configured |
| Testing | Jest, ts-jest |
| Code quality | SonarQube (Community Edition) |
| Infrastructure | Docker, Docker Compose |

## Architecture

The backend follows a layered structure:

```
routes/          → HTTP layer: parses requests, calls business functions, formats responses
  voice/         → AI assistant split by responsibility (prompts, tool schemas, tool executor)
middleware/      → authGuard / adminGuard (JWT verification), errorHandler (global error formatting)
errors/          → AppError hierarchy (ValidationError, NotFoundError, ConflictError, ...)
utils/           → asyncHandler (removes repeated try/catch), fileUpload (shared multer config)
config/          → database connection pool
types.ts         → shared TypeScript interfaces, single source of truth for DB row shapes
```

Business logic functions (e.g. `createAppointment`, `searchFlights`, `joinWaitlist`) are exported independently from their HTTP routes, so the same function is called whether the request comes from the REST API **or** from Nestor's function-calling tools — no internal HTTP calls, no duplicated logic.

Errors are raised as typed `AppError` subclasses and caught once, centrally, by `errorHandler` — routes never format their own error responses.

## Getting started (Docker)

The whole stack (frontend, backend, MySQL, SonarQube) runs via Docker Compose.

```bash
cp .env.example .env
# fill in your API keys (Groq, ElevenLabs, Duffel, Google OAuth, JWT secrets...)

docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- MySQL: localhost:3307 (mapped from the container's 3306)
- SonarQube: http://localhost:9000

### Running database migrations / constraints

After the containers are up, apply the referential integrity constraints (foreign keys, checks — see `sql/constraints.sql`):

```bash
docker compose exec mysql mysql -u nestor -pnestor nestor_vocal < sql/constraints.sql
```

### Local development (without Docker)

```bash
# Backend
cd backend
npm install
npm run dev        # ts-node-dev, hot reload

# Frontend
cd frontend
npm install
npm run dev         # Vite dev server, proxies /api to localhost:4000
```

## Testing

```bash
cd backend
npx jest
```

Unit tests focus on pure business logic and error handling (no test double for MySQL is needed for most of them; a small number mock the connection pool with `jest.mock`):

- `formatIsoDuration`, `mapDuffelOffer` — Duffel API response normalization
- `mergeMonthlySeries` — dashboard chart data aggregation
- `AppError` hierarchy — correct HTTP status codes per error type
- `asyncHandler` — error propagation to Express's error middleware
- `stripDocumentTypePrefix`, `createNotificationIfNotRecent` — notification deduplication logic (mocked pool)

## Code quality

SonarQube analysis runs as a Docker Compose profile:

```bash
docker compose --profile tools run --rm sonar-scanner
```

See `sonar-project.properties` for source/test paths and coverage report wiring.

## Project structure

```
nestor-vocal/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── errors/
│   │   ├── utils/
│   │   ├── config/
│   │   ├── types.ts
│   │   └── index.ts        # entry point (app.listen)
│   └── src/tests/
├── frontend/
│   └── src/
│       ├── pages/
│       ├── pages/admin/
│       ├── components/shared/
│       ├── lib/
│       └── utils/
├── docker-compose.yml
├── sonar-project.properties
├── sql/constraints.sql
└── docs/MCD_MLD.md
```

## Security notes

- Passwords hashed with bcrypt (cost factor 12).
- Password reset uses a random 32-byte token with a 1-hour expiry; the API always returns the same response whether or not the email exists, to prevent account enumeration.
- Admin and client authentication use **separate** JWT secrets and separate guards — an admin token cannot be used against client-only routes and vice versa.
- Blocked users (`users.blocked`) are rejected at login, not just hidden in the UI.
- SQL queries use parameterized statements (`mysql2` placeholders) throughout — no string-concatenated SQL.
