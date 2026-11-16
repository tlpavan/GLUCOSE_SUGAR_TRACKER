# Blood Sugar Tracker (Kenpath Sweety)

React/Vite + Express + PostgreSQL. Milestone 2 adds versioned persistence and
registration/login; reading CRUD, reports and auth UI remain deferred.

## Local configuration

Use the PostgreSQL **17** service and its configured port (16 may also be running).
Have a local administrator create a dedicated LOGIN role with a private password,
without SUPERUSER, CREATEDB or CREATEROLE, and grant it CONNECT and schema USAGE,
CREATE on `public` in both existing databases: `sweety_dev` and `sweety_test`.
It must own the tables it migrates. Do not use the `postgres` administrator account
in the application. The URL and real-connection guards reject superuser use.

Create ignored files locally; never paste credentials into chat, terminal output,
Git, screenshots or a command argument. `.env.example` documents every variable.

- `.env`: development settings, `DATABASE_URL` ending in `/sweety_dev`, and
  `JWT_SECRET` containing at least 32 cryptographically random bytes encoded as
  hex or base64. URL-encode special characters in the database password.
- `.env.test`: `NODE_ENV=test` and `TEST_DATABASE_URL` ending in `/sweety_test`.
  Use a dedicated local non-superuser role here too. Tests generate their own
  ephemeral JWT signing secret; no JWT secret is needed in this file.

The URL guard permits only localhost/loopback, an exact database name, and no
query options. This milestone intentionally targets local databases.

## Commands (project root, PowerShell)

```powershell
npm install                                      # only for fresh dependency setup
npm run migrate --workspace server                # sweety_dev
npm run migrate:test --workspace server           # sweety_test only
npm test                                         # ALL backend tests, including real PostgreSQL
npm run build                                    # React production regression check
npm run dev
```

The React app uses `http://localhost:5173`; Express uses
`http://localhost:5000`. Vite proxies `/api` to Express. The foundation health
route is a process-liveness check, not a database readiness endpoint.

`npm test` fails, rather than skips, when the isolated real test database is not
configured or unavailable. It never loads `.env` or falls back to `DATABASE_URL`.
Before migrations and destructive test cleanup, guards check both the parsed URL
and PostgreSQL's actual `current_database()` and non-superuser role. Test cleanup
truncates only `sweety_test`'s users/readings, so do not store valuable data there.
The test runner is serial to avoid cleanup races between test files.

To run just the database-independent backend checks:

```powershell
node --test server/tests/app.test.js server/tests/reading-slots.test.js server/tests/auth.test.js server/tests/database-guard.test.js
```

## Authentication contract

This milestone follows the requested **bearer JWT** flow, superseding the earlier
cookie proposal in `docs/requirements.md`. It does not implement cookies or logout.

| Endpoint | Request | Result |
| --- | --- | --- |
| `POST /api/auth/register` | `{ name, email, password }` | 201 `{ user, token, tokenType, expiresIn }` |
| `POST /api/auth/login` | `{ email, password }` | 200, same response shape |
| `GET /api/auth/me` | `Authorization: Bearer <token>` | 200 `{ user }`; minimal protected verification endpoint |

Public users contain only `{ id, name, email }`. Names are trimmed (1–100
characters), emails trimmed/lowercased (valid format, max 254), passwords validated
at 8–72 **UTF-8 bytes** without trimming. Unknown request fields are rejected,
including client-supplied user IDs. bcrypt cost 12 hashes are never returned.
Unknown email and incorrect password produce the same generic 401; unknown users
also incur a bcrypt comparison to reduce timing differences.

JWTs expire after 15 minutes. Verification pins HS256, issuer, audience and positive
integer subject, and requires expiration/issued-at with bounded lifetime. Middleware
sets `req.auth.userId` only after verification, never from body/query/headers that
claim an identity. `/me` also confirms the account still exists. Authentication
responses set `Cache-Control: no-store`. No token/password/request logging is used.
Clients should keep tokens in memory; a future frontend should avoid localStorage.

Errors preserve `{ error: { code, message, fields? } }`: 400 validation, 401 bad
credentials/token, 409 duplicate email, 404 missing route and safe 500 unexpected
errors. Malformed/oversized JSON is handled without exposing parser input.

## Database structure and rationale

`001_create_users_and_readings.sql` creates precisely the milestone's columns.
The earlier `updated_at` proposal remains deferred, as do all reading endpoints.

- Identity primary keys give users/readings stable database-issued IDs.
- `users_email_normalized` requires lowercase, trimmed nonblank stored email;
  unique `lower(email)` prevents case-insensitive duplicates even under concurrent
  registrations. The API catches PostgreSQL's authoritative uniqueness conflict.
- Required nonblank names and hashes keep unusable records out of the database.
- `readings.user_id` references `users.id`; `ON DELETE CASCADE` prevents orphan
  health data if account deletion is implemented later.
- The exact four-slot CHECK mirrors the existing canonical domain constant:
  `morning_fasting`, `after_breakfast`, `after_lunch`, `after_dinner`.
- SMALLINT plus the inclusive 40–600 CHECK enforce whole-number storage and bounds.
- Unique `(user_id, reading_date, slot)` caps each user at four slots per day while
  allowing another user the same date/slot. Its leading columns also index reports.
- `created_at TIMESTAMPTZ` records creation instants consistently. Future-date API
  validation belongs to the reading milestone, not a changing-date CHECK.

`runMigrations` uses a transaction, advisory lock and checksummed version ledger:
concurrent runners serialize, failures roll back, repeated runs do nothing, and
editing an already-applied migration is refused. Add a new numbered SQL file for
future changes. There is no automatic down migration or destructive reset command.

`createPool` bounds connections and timeouts; repositories use `$1`-style bound
parameters for every user value. Database credentials remain server-only.
`server.js` verifies database identity at startup and closes HTTP/pool resources
on termination. Raw configuration/driver errors are never printed because they
can contain secrets.

## Verification and remaining scope

Backend coverage includes foundation/slot regressions, byte-based password
validation, invalid JWTs, real registration/login and bcrypt hashes, concurrent
duplicate emails, migration idempotence, database constraints and isolation guards.
PostgreSQL results are valid only after the real integration suite executes.

Reading CRUD, reports, auth UI, logout/revocation, deployment, rate limiting,
password reset and email verification are outside this milestone. Add login and
registration throttling before exposing this local-development API publicly.
Do not automatically commit, push or publish.
