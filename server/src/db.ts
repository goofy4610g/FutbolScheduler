import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "futbolscheduler.db");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    division TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    jersey_number TEXT,
    position TEXT,
    birth_date TEXT
  );

  CREATE TABLE IF NOT EXISTS fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    location TEXT,
    default_duration_minutes INTEGER,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS field_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS season_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    season_name TEXT,
    start_date TEXT,
    end_date TEXT,
    games_per_matchup INTEGER DEFAULT 1,
    default_game_duration_minutes INTEGER DEFAULT 60,
    break_between_games_minutes INTEGER DEFAULT 15
  );

  CREATE TABLE IF NOT EXISTS theme_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    league_name TEXT DEFAULT 'My Soccer League',
    primary_color TEXT DEFAULT '#1e6f3e',
    secondary_color TEXT DEFAULT '#0b3d24',
    accent_color TEXT DEFAULT '#f2b705',
    background_color TEXT DEFAULT '#f7f9f8',
    text_color TEXT DEFAULT '#152118',
    header_text TEXT DEFAULT 'Soccer Season Scheduler',
    font_family TEXT DEFAULT 'system-ui, sans-serif',
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS schedule_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    season_name TEXT
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL REFERENCES schedule_batches(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    field_id INTEGER REFERENCES fields(id) ON DELETE SET NULL,
    home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    home_score INTEGER,
    away_score INTEGER
  );

  CREATE TABLE IF NOT EXISTS blackout_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    reason TEXT
  );
`);

db.prepare(
  `INSERT OR IGNORE INTO season_config (id) VALUES (1)`
).run();
db.prepare(
  `INSERT OR IGNORE INTO theme_config (id) VALUES (1)`
).run();
