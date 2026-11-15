# Blood Sugar Tracker

A React, Express, and PostgreSQL application for privately recording blood
glucose readings and reviewing daily and monthly reports.

## Current milestone

The repository currently contains the runnable React/Express foundation and API
health tests. Authentication, PostgreSQL migrations, reading CRUD, reports, and
seed data are intentionally deferred to subsequent reviewed milestones.

## Prerequisites

- Node.js 18 or newer. A currently supported LTS release is recommended.
- npm 10 or newer.
- PostgreSQL, including the `psql`, `createuser`, and `createdb` command-line
  tools, before the database milestone.

## Local setup

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The React app runs at `http://localhost:5173`. Its `/api` requests are proxied
to the Express API at `http://localhost:5000`.

Do not place real production credentials in `.env`, logs, screenshots, or Git.

## Commands

```powershell
npm run dev       # Run React and Express together
npm run build     # Create the production frontend build
npm test          # Run backend tests
```

## Requirements and assumptions

See [`docs/requirements.md`](docs/requirements.md) for the accepted scope, API
contract, schema proposal, acceptance criteria, and the previous-calendar-month
report assumption.

