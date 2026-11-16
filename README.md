# Blood Sugar Tracker (Kenpath Sweety)

React/Vite + Express + PostgreSQL. Milestone 4 adds daily, month-to-date and
previous-calendar-month reports to the authenticated reading CRUD backend.
React report screens remain deferred.

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
The earlier `updated_at` proposal remains deferred. Reading CRUD uses this existing schema.

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
  validation is enforced by the reading API, not a changing-date CHECK.

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

Auth/report UI, logout/revocation, deployment, rate limiting,
password reset and email verification are outside this milestone. Add login and
registration throttling before exposing this local-development API publicly.
Do not automatically commit, push or publish.


## Milestone 3 reading API

All routes require `Authorization: Bearer <token>`. The account must still exist.
Create and PUT requests use exactly these three fields (PUT is a full replacement):

```json
{ "date": "2026-11-16", "slot": "morning_fasting", "valueMgDl": 100 }
```

| Endpoint | Success |
| --- | --- |
| `POST /api/readings` | 201 `{ reading }` |
| `GET /api/readings?date=YYYY-MM-DD` | 200 `{ readings }`, in canonical slot order; empty list when absent |
| `PUT /api/readings/:id` | 200 `{ reading }` |
| `DELETE /api/readings/:id` | 204, empty body |

Reading responses contain `id`, `date`, `slot`, `valueMgDl` and `createdAt`.
List requires a date. Unknown fields, including client-supplied ownership fields,
are rejected. Validation errors use 400 and the existing `error.fields` envelope;
unauthenticated requests use 401. A missing or foreign-owned reading returns the
same 404 on update/delete, and duplicate date/slot writes return 409 `READING_EXISTS`.

The shared create/update validator accepts only real YYYY-MM-DD dates and JSON
integer values from 40 to 600 inclusive. It rejects numeric strings, fractions,
missing values, invalid dates and future dates. Today is calculated in configured
`APP_TIME_ZONE` (default Asia/Kolkata); timestamps are not accepted as reading dates.
Calendar validation checks month lengths/leap years directly. SQL formats DATE
as a date-only string so timezone conversion cannot move the response to another day.

Every list/update/delete SQL statement includes the verified JWT user ID and uses
bound parameters. The existing four-slot CHECK and unique user/date/slot constraint
provide the four-per-day maximum, including simultaneous requests. A separate
count-before-insert check would introduce a race, so PostgreSQL decides uniqueness.
Failed conflicting updates leave the original record intact. Responses disable caching.

Verification: `npm test` runs the original tests plus 28 reading/date tests against
an isolated real `sweety_test` database. Coverage includes the full lifecycle,
boundary/invalid values on both writes, leap dates and timezone midnight, concurrent
duplicates, four-slot limits, conflicting edits and cross-user isolation.
`npm run build` checks the unchanged React production build. Tests reset only the
explicitly guarded test database; no development migration is needed for this milestone.


## Milestone 4 mandatory reports

All three endpoints require a verified bearer token and an existing account.
Only the required `date=YYYY-MM-DD` query parameter is accepted. Invalid or future
selected dates return 400 with the existing `error.fields.date` envelope;
missing/invalid authentication returns 401. Successful reports return 200.

| Endpoint | Inclusive range for selected date 2026-10-15 |
| --- | --- |
| `GET /api/reports/daily?date=2026-10-15` | 2026-10-15 through 2026-10-15 |
| `GET /api/reports/month-to-date?date=2026-10-15` | 2026-10-01 through 2026-10-15 |
| `GET /api/reports/previous-month?date=2026-10-15` | 2026-09-01 through 2026-09-30 |

All responses contain `range`, `summary` and `readings`. The summary uses `min`
(lowest), `max` (highest), `average` (rounded to one decimal) and `count`.
Readings use the CRUD response shape and are sorted by date and canonical slot
order. Daily reports also return `slots`: four `{ slot, reading }` entries in
canonical order, with `reading: null` for a missing measurement.

Synthetic populated previous-month example:

```json
{
  "range": { "startDate": "2026-09-01", "endDate": "2026-09-30" },
  "summary": { "min": 101, "max": 101, "average": 101, "count": 1 },
  "readings": [
    { "id": 1, "date": "2026-09-15", "slot": "morning_fasting", "valueMgDl": 101, "createdAt": "2026-09-15T04:00:00.000Z" }
  ]
}
```

Empty daily example:

```json
{
  "range": { "startDate": "2026-10-15", "endDate": "2026-10-15" },
  "summary": { "min": null, "max": null, "average": null, "count": 0 },
  "readings": [],
  "slots": [
    { "slot": "morning_fasting", "reading": null },
    { "slot": "after_breakfast", "reading": null },
    { "slot": "after_lunch", "reading": null },
    { "slot": "after_dinner", "reading": null }
  ]
}
```

Empty monthly reports use the same null summary and empty list, without `slots`.
This lets the future UI show "No readings for this period" without displaying
zero as a glucose measurement. JSON numbers do not preserve trailing zeros:
`101` represents the rounded value `101.0`; the future UI can use `toFixed(1)`.

Range calculations work on calendar components. Daily uses the selected date
for both boundaries. Month-to-date substitutes day 01 for the start. Previous
month decrements the month (January becomes December of the preceding year),
then reuses calendar validation to select its final valid day, including leap
February. No date-only input is converted into a JavaScript midnight timestamp.
Today is checked in `APP_TIME_ZONE`, consistently with CRUD. Previous-month
requests for January 0001 return a field error rather than generating year 0000.

A single parameterized SQL statement scopes both details and MIN/MAX/AVG/COUNT
to the verified user ID and inclusive DATE bounds. PostgreSQL rounds the exact
numeric AVG once; the repository converts it to a JSON number and preserves null
for empty aggregates. Fetching summary and details in one statement keeps them
consistent during concurrent reading changes. Existing database constraints and
the four-slot specification are unchanged; no schema migration is needed.

Verification commands remain `npm test`, `npm run build` and `git diff --check`.
The report tests add calendar boundary cases and real PostgreSQL checks for
statistics, rounding, inclusive boundaries, empty reports, date validation,
unauthenticated/deleted accounts and cross-user isolation. No report UI, charts,
optional report types, cache or dependency is introduced in this milestone.
