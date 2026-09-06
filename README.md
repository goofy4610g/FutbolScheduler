# FutbolScheduler

A soccer season scheduling app: import teams/players/coaches from a spreadsheet, configure
fields/game times/season settings, customize branding, and generate a conflict-free round-robin
schedule.

## Stack

- **client/** — React + TypeScript + Vite frontend
- **server/** — Node.js + Express + SQLite (better-sqlite3) API

## Getting started

```bash
npm run install:all   # installs both server and client dependencies
npm run dev           # runs the API (port 4000) and the frontend (port 5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api` and `/uploads` requests to
the Express API on port 4000.

The SQLite database file is created automatically at `server/data/futbolscheduler.db` on first
run — no setup required.

## Workflow

1. **Data Upload** — upload a CSV/TSV/XLSX file of teams, then players and coaches (which link to
   teams by name).
2. **Configuration** — add fields, define the days/times each field is available and how long
   games run, and set season start/end dates plus how many times each team plays every other team.
3. **Branding** — set league name, header text, colors, font, and logo; changes apply across the
   whole app immediately.
4. **Schedule** — generate a round-robin schedule. The scheduler avoids double-booking a team or a
   field/time slot, and reports any matchups it couldn't fit so you can add more field time.

## Project structure

```
server/
  src/
    db.ts              SQLite schema + connection
    routes/             upload, config (fields/season/theme), entities, schedule
    services/
      parser.ts          CSV/XLSX ingestion
      scheduler.ts        round-robin generation + slot assignment
client/
  src/
    pages/               Dashboard, Upload, Configuration, Branding, Schedule
    context/ThemeContext  applies branding as CSS variables app-wide
    components/Layout     header/nav shell
```

## Individual commands

```bash
npm run dev:server   # API only
npm run dev:client   # frontend only
npm run build         # typecheck + build both for production
```
