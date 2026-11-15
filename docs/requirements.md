# Blood Sugar Tracker — Product Requirements

## 1. Product goal

Build a secure web application in which an authenticated user can record blood glucose readings, maintain only their own readings, and review daily and calendar-based reports.

## 2. Required technology

- React frontend.
- Node.js with Express API.
- PostgreSQL database.
- `bcrypt` for password hashing.
- Parameterized SQL and database constraints for data integrity.

## 3. Functional requirements

### 3.1 Authentication

- A visitor can register with a name, email address, and password.
- A registered user can log in and log out.
- Email addresses are normalized to lowercase before storage and comparison.
- Passwords are stored only as bcrypt hashes. Plain-text passwords must never be stored, returned, or logged.
- All reading and report endpoints require authentication.
- A user must never be able to view, change, or delete another user's data.

### 3.2 Blood glucose readings

Each reading contains:

- A calendar date in `YYYY-MM-DD` format.
- One of four slots:
  - `morning_fasting` — Morning (fasting)
  - `after_breakfast` — After breakfast
  - `after_lunch` — After lunch
  - `after_dinner` — After dinner
- An integer glucose value in mg/dL.

These are the complete and exact permitted slots. Additional slots, including a
snacks slot, are outside the specification and must be rejected.

An authenticated user can:

- Create a reading.
- View their readings for a selected date.
- Edit one of their readings.
- Delete one of their readings.

### 3.3 Reading validation and integrity

- Date, slot, and value are required.
- The value must be an integer from 40 through 600 inclusive.
- A reading date must be a real calendar date and must not be later than today's date.
- A user may have at most one reading for each date and slot.
- Because only four slots are valid and each user/date/slot tuple is unique, a user can have at most four readings on a date.
- The API is the authoritative validation boundary. PostgreSQL also enforces the value range, allowed slots, foreign key, and uniqueness rules.
- Validation and conflict failures return safe, useful error messages that the React UI displays near the relevant form or action.

### 3.4 Reports

All date ranges are inclusive.

#### Daily report

For a selected date, show:

- Minimum value.
- Maximum value.
- Average value rounded to one decimal place.
- Reading count.
- The four slots in canonical order, including an empty indication for a missing slot.

#### Month-to-date report

For a selected date, report from the first day of that selected date's month through the selected date.

#### Previous-month report

Assumption: “monthly report” means the complete previous calendar month relative to the selected date. For example, selecting `2026-11-15` produces a range of `2026-10-01` through `2026-10-31`.

The month-to-date and previous-month reports include a summary (minimum, maximum, one-decimal average, and count) and the matching readings ordered by date and slot.

### 3.5 Empty and error states

- A selected date with no readings shows a friendly empty state and still makes all four slots easy to add.
- A report range with no readings shows a friendly empty state rather than zeros that could be mistaken for measurements.
- For an empty aggregate, `count` is `0` and `min`, `max`, and `average` are `null`.
- Authentication, validation, duplicate, not-found, and unexpected-server errors have distinct, user-friendly messages.

## 4. Security and privacy requirements

- Never commit or expose database passwords, token secrets, real credentials, or real user health data.
- Do not log passwords, authentication tokens, cookie values, or database connection strings.
- Use bcrypt to hash passwords before insertion.
- Use parameterized queries for every value passed to SQL.
- Scope every reading lookup, update, and delete by the authenticated `user_id` in the SQL query itself.
- Return the same `404` response for a missing reading and a reading owned by someone else, avoiding ownership disclosure.
- Authentication cookies, if approved, must be `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Do not return `password_hash` from API responses.

## 5. Proposed data model

### `users`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `INTEGER GENERATED ALWAYS AS IDENTITY` | Primary key |
| `name` | `VARCHAR(100)` | Required; nonblank after trimming |
| `email` | `VARCHAR(254)` | Required; stored lowercase |
| `password_hash` | `TEXT` | Required |
| `created_at` | `TIMESTAMPTZ` | Required; defaults to current timestamp |
| `updated_at` | `TIMESTAMPTZ` | Required; defaults to current timestamp |

A unique index on `LOWER(email)` enforces case-insensitive email uniqueness without requiring the optional PostgreSQL `citext` extension.

### `readings`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `INTEGER GENERATED ALWAYS AS IDENTITY` | Primary key |
| `user_id` | `INTEGER` | Required; foreign key to `users(id)` with `ON DELETE CASCADE` |
| `reading_date` | `DATE` | Required |
| `slot` | `TEXT` | Required; check constraint permits the four canonical values |
| `value_mg_dl` | `SMALLINT` | Required; check constraint from 40 through 600 |
| `created_at` | `TIMESTAMPTZ` | Required; defaults to current timestamp |
| `updated_at` | `TIMESTAMPTZ` | Required; defaults to current timestamp |

A unique constraint on `(user_id, reading_date, slot)` prevents duplicate slots and, together with the slot check, limits each user to four readings per day. An index on `(user_id, reading_date)` supports day and date-range queries.

The API validates “no future dates.” A database trigger could duplicate this rule, but a check constraint based on the changing current date is unsuitable because check constraints should describe immutable row validity.

## 6. Proposed API contract

All routes are under `/api`. JSON property names use camelCase. Successful authentication sets a protected cookie; clients send requests with credentials enabled.

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "valueMgDl": "Value must be an integer from 40 to 600."
    }
  }
}
```

`fields` is optional. Expected statuses are `400` for invalid input, `401` for unauthenticated access, `404` for absent or inaccessible resources, `409` for email or reading conflicts, and `500` for safe unexpected errors.

### Authentication

| Method and path | Request | Success |
| --- | --- | --- |
| `POST /api/auth/register` | `{ name, email, password }` | `201`, sets cookie, returns `{ user }` |
| `POST /api/auth/login` | `{ email, password }` | `200`, sets cookie, returns `{ user }` |
| `POST /api/auth/logout` | None | `204`, clears cookie |
| `GET /api/auth/me` | None | `200`, returns `{ user }` |

The public user shape is `{ id, name, email }`. Password policy proposal: 8–72 UTF-8 bytes, with a clear message for longer values because bcrypt only considers the first 72 bytes.

### Readings

| Method and path | Request | Success |
| --- | --- | --- |
| `GET /api/readings?date=YYYY-MM-DD` | Query date | `200`, `{ readings: [...] }` |
| `POST /api/readings` | `{ date, slot, valueMgDl }` | `201`, `{ reading }` |
| `PUT /api/readings/:id` | Complete `{ date, slot, valueMgDl }` | `200`, `{ reading }` |
| `DELETE /api/readings/:id` | None | `204` |

The reading shape is `{ id, date, slot, valueMgDl, createdAt, updatedAt }`. Results use canonical slot order rather than alphabetical order.

### Reports

| Method and path | Range |
| --- | --- |
| `GET /api/reports/daily?date=YYYY-MM-DD` | Selected date only |
| `GET /api/reports/month-to-date?date=YYYY-MM-DD` | First of selected month through selected date |
| `GET /api/reports/previous-month?date=YYYY-MM-DD` | Complete calendar month before the selected date's month |

Common summary shape:

```json
{
  "range": { "startDate": "2026-11-01", "endDate": "2026-11-15" },
  "summary": { "min": 82, "max": 164, "average": 117.4, "count": 12 },
  "readings": []
}
```

The daily response additionally exposes all four canonical slots, using `null` for a missing reading. Aggregate SQL filters by authenticated `user_id`; the API converts PostgreSQL numeric aggregate results to JSON numbers.

## 7. Acceptance criteria

### Authentication and isolation

- Registering creates a user whose stored password value is a bcrypt hash and whose API response excludes that hash.
- Duplicate email registration is rejected regardless of letter case.
- Correct credentials authenticate; incorrect credentials return a safe generic failure.
- Protected endpoints reject unauthenticated requests.
- User A cannot list, edit, delete, or report on User B's readings, even by guessing IDs or dates.

### Reading CRUD and validation

- Values `40` and `600` are accepted.
- Values `39`, `601`, decimals, numeric strings, missing values, invalid slots, and invalid dates are rejected.
- Exactly `morning_fasting`, `after_breakfast`, `after_lunch`, and `after_dinner` are accepted as slots; `snacks` and every other unrecognized slot are rejected.
- Today's date is accepted; tomorrow and other future dates are rejected.
- A second reading for the same user/date/slot returns a conflict.
- Different users may use the same date/slot, and one user may use all four distinct slots on a date.
- Create, list, replace, and delete operations persist correctly and remain user-scoped.

### Reports

- Daily min, max, count, and average are correct; average is returned to exactly one decimal in the displayed UI.
- The daily response represents each slot and clearly identifies missing slots.
- Month-to-date includes the first day and selected date and excludes surrounding dates.
- Previous-month includes both boundaries of the complete prior calendar month, including year changes and leap-year February where applicable.
- Empty reports return `count: 0`, null aggregates, and render a friendly message.

### Delivery and quality

- A fresh setup works from documented commands with PostgreSQL configuration supplied through environment variables.
- `.env.example` contains names and safe examples only, with no usable secrets.
- A seed command creates one clearly labeled demo user and synthetic readings.
- Backend tests cover boundaries, duplicate slots, invalid/future dates, report calculations and ranges, and cross-user isolation.
- Tests run against a separate test database and refuse to run against a non-test database.
- README documents setup, configuration, run/test/seed commands, the previous-calendar-month assumption, trade-offs, and possible improvements.
- Repository history contains multiple meaningful commits.
- Screenshots or a short demonstration recording show the working product.

## 8. Initial scope exclusions

- Paid AI APIs or an AI model.
- Docker.
- Redis or background job queues.
- Charts.
- Doctor or administrator roles.
- Password reset, email verification, social login, and multi-factor authentication.
- Deployment automation, unless time remains after mandatory requirements pass.

## 9. Proposed quality approach

- Unit tests for pure date-range and validation helpers where useful.
- API integration tests with Node's built-in test runner, Supertest, and a real, isolated PostgreSQL test database.
- Test database reset between tests with guarded truncation.
- React component tests only for high-value validation/error/empty states after required backend coverage is complete.
- Manual browser verification of the end-to-end registration, login, CRUD, report, empty, and isolation flows.

## 10. Deferred improvements

- Refresh-token rotation or server-side sessions for stronger revocation controls.
- CSRF tokens if the frontend and API later operate in a cross-site configuration.
- Accessibility audit and broader frontend automated coverage.
- Pagination/export for larger histories.
- User-configurable timezone and units.
- Audit history and account deletion workflow.
