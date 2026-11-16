# Sweety — Blood Glucose Tracker

A full-stack web application for recording blood glucose measurements and reviewing daily and monthly summaries. Sweety supports secure user accounts, up to four readings per day, and reports calculated from saved measurements.

**Tech stack:** React (Vite) · Node.js · Express · PostgreSQL · JavaScript

> **Note:** Sweety is a tracking and reporting application, not a medical diagnostic tool. Measurements are entered by the user from a glucose-testing device. Meal-related slots describe *when* a reading was taken; the app does not calculate blood glucose from food.

## Features

- Register with name, email and password, then sign in.
- Passwords are hashed with **bcrypt**. Protected routes use **JWT bearer authentication**.
- Users can create, view, update and delete **only their own** glucose readings.
- Choose from exactly four daily slots:
  1. Morning (fasting)
  2. After breakfast
  3. After lunch
  4. After dinner
- Each reading records a calendar date, one slot and a glucose value in **mg/dL**.
- Validation rejects missing readings, non-integer values, values outside **40–600 mg/dL**, future dates, duplicate user/date/slot combinations, and more than four readings per day. The UI displays validation and server errors.
- View three reports for a selected date:
  - **Daily:** readings on that date, including the four slots.
  - **Month-to-date:** first day of the selected month through the selected date, inclusive.
  - **Previous month:** the entire calendar month preceding the selected month.
- Reports display the **minimum, maximum, average (one decimal place) and reading count**. Empty reports show a friendly state.
- Responsive interface with login, reading management and reports. The glucose-meter illustration is decorative; values displayed in it are illustrative.

## Architecture

```text
React + Vite client
    │ HTTPS/HTTP JSON requests + JWT bearer token
    ▼
Node.js + Express REST API
    ├── Authentication: registration, login, token verification
    ├── Reading CRUD: validation and user-scoped access
    └── Reports: calendar ranges and aggregate statistics
    │
    ▼
PostgreSQL
    ├── Users (bcrypt password hashes)
    ├── Glucose readings (owner, date, slot, value)
    └── Versioned database migrations
```

**Key decisions**

- **PostgreSQL constraints** complement API validation, including uniqueness of each user's date/slot combination.
- The server derives reading ownership from the **verified JWT**, never from a client-supplied user ID.
- Dates are treated as calendar dates rather than timestamps; the API uses its configured application time zone to reject future dates.
- Reports are calculated from stored glucose readings, not food logs or estimated clinical thresholds.
- The frontend communicates with the Express API and keeps the authenticated session in application memory. A browser refresh may require signing in again.

## Project structure

```text
client/                 # React/Vite UI, API helper and frontend tests
server/
  src/                  # Express API, authentication, readings, reports and DB code
  scripts/seed.js       # Demo account and synthetic glucose readings
  package.json          # Server scripts and dependencies
README.md
.env.example            # Example configuration (no real secrets)
```

## Requirements

- Node.js and npm (use a version supported by the project's installed dependencies)
- PostgreSQL running locally
- A PostgreSQL database and a dedicated application database user

## Local setup

Run these commands from the project root unless noted otherwise.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the provided `.env.example` to the location expected by the server configuration, and fill in your **local** PostgreSQL connection details and JWT signing secret. Check the server configuration for exact required variable names. Use a strong, non-public signing secret; never commit `.env`, `.env.test`, real database credentials or production secrets.

For automated database integration tests, configure the project's separate `sweety_test` database and a dedicated **non-superuser** test role as required by the existing test safety checks. The tests refuse to write to a database other than the configured test database.

### 3. Apply database migrations

```bash
npm run migrate --workspace server
```

To migrate the separately configured test database:

```bash
npm run migrate:test --workspace server
```

### 4. Start the application

```bash
npm run dev
```

- React frontend: **http://localhost:5173**
- Express API: **http://localhost:5000**

To run client and server in **separate terminals** instead, use these root-level commands:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

### 5. Generate demo data

Keep the local API server running and, in another terminal, run:

```bash
node server/scripts/seed.js
```

The seed script creates a demo account with **11 synthetic readings**, spread across dates and the four required slots. It can be rerun without creating duplicate date/slot readings; existing readings are skipped. By default the script connects to the local API; a `SEED_API_URL` environment variable can override its local API URL.

**Demo credentials (for local demonstration only)**

```text
Email:    sweety.demo@example.com
Password: SweetyDemo@2026
```

Do not use these public demonstration credentials in a real deployment. If you rerun the script with an existing demo account whose password has changed, the login step will fail and should be corrected in the local development environment.

## API endpoints

All reading and report endpoints require a valid bearer token.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register an account |
| POST | `/api/auth/login` | Authenticate and obtain a JWT |
| GET | `/api/auth/me` | Get authenticated user details |
| POST | `/api/readings` | Add a reading |
| GET | `/api/readings` | List readings; supports date filtering |
| PUT | `/api/readings/:id` | Update a reading owned by the current user |
| DELETE | `/api/readings/:id` | Delete a reading owned by the current user |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Daily report |
| GET | `/api/reports/month-to-date?date=YYYY-MM-DD` | Month-to-date report |
| GET | `/api/reports/previous-month?date=YYYY-MM-DD` | Previous full month report |

Example reading request body:

```json
{
  "date": "2026-11-16",
  "slot": "morning_fasting",
  "valueMgDl": 100
}
```

The API returns meaningful status codes for invalid inputs, conflicts, unauthenticated requests and inaccessible records. The frontend presents these errors to the user.

## Testing and build

From the repository root:

```bash
npm test
node --test client/tests/frontend.test.js
npm run build
```

- The backend tests cover authentication, bcrypt persistence, verified-token ownership, PostgreSQL integrity, reading CRUD validation and calendar-report boundaries.
- The frontend tests cover slot and date validation, request contracts, bearer authorization, API error handling and session expiry behavior.
- The production build checks that the React application compiles and bundles.

**Last locally reported verification:** 82 backend tests passed, 8 frontend tests passed, and the React production build passed after a JSX syntax fix. These automated checks do not replace manual browser verification of the final interface.

## Screenshots

Capture these images **from the actual running application** and save them in `docs/screenshots/`:

| Filename | What to show |
|---|---|
| `login.png` | Sweety sign-in screen, including meter illustration |
![alt text](<Screenshot 2026-11-16 193925.png>) 

| `readings.png` | Existing readings and an add/edit reading form |
![alt text](<Screenshot 2026-11-16 194014.png>)
| `dashboard.png` | Authenticated dashboard with seeded readings |
 ![alt text](<Screenshot 2026-11-16 194044.png>) 
| `reports.png` | Daily and monthly summary report(s) |
![alt text](<Screenshot 2026-11-16 194105.png>)
After placing those images in the folder, add the following lines to this section to display them on GitHub:

```md
![Sweety login](docs/screenshots/login.png)
![Sweety dashboard](docs/screenshots/dashboard.png)
![Glucose readings](docs/screenshots/readings.png)
![Reports](docs/screenshots/reports.png)
```

Do not commit generated concept mockups as if they were application screenshots. Alternatively, provide a **2–3-minute recording** showing registration/login, adding a reading, validation, editing/deleting, and reports.

## Notes

### Assumptions

- One account represents one person tracking their own readings.
- A reading is a **manually entered measurement**, not a prediction from diet or food intake.
- Each user may record **one reading per required slot per calendar day**, for a maximum of four.
- A slot indicates the reading's timing relative to a meal; no clinical interpretation or normal/high threshold is inferred.
- All reports are based on the date selected by the user. Previous month means the **entire previous calendar month**, not a rolling 30-day window.
- The app is intended as a local demonstration; production deployment would need environment-specific security and operational configuration.

### Improvements with more time

- Dedicated deployment configuration and hosted PostgreSQL setup.
- A more extensive browser-based end-to-end testing suite.
- Optional accessibility and responsive-layout audits across devices.
- Exportable reading history and accessible data visualizations.
- Optional password reset and session management suitable for production.

## Submission

The assignment requests a **public GitHub repository with meaningful commits** and **actual screenshots or a short screen recording**. Reply to the Kenpath assignment email with the repository URL and demonstration material.
