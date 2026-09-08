import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";

export const configRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "data", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `logo-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

configRouter.post("/theme/logo", logoUpload.single("logo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const logoUrl = `/uploads/${req.file.filename}`;
  db.prepare(`UPDATE theme_config SET logo_url = ? WHERE id = 1`).run(logoUrl);
  res.json({ logo_url: logoUrl });
});

// ---- Fields ----
configRouter.get("/fields", (_req, res) => {
  const fields = db.prepare(`SELECT * FROM fields ORDER BY name`).all();
  const availability = db.prepare(`SELECT * FROM field_availability ORDER BY day_of_week, start_time`).all() as Array<{
    id: number;
    field_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  const withAvailability = (fields as Array<{ id: number }>).map((field) => ({
    ...field,
    availability: availability.filter((a) => a.field_id === field.id),
  }));
  res.json(withAvailability);
});

configRouter.post("/fields", (req, res) => {
  const { name, location, default_duration_minutes, notes } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const info = db
    .prepare(`INSERT INTO fields (name, location, default_duration_minutes, notes) VALUES (?, ?, ?, ?)`)
    .run(name, location ?? null, default_duration_minutes ?? null, notes ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

configRouter.put("/fields/:id", (req, res) => {
  const { name, location, default_duration_minutes, notes } = req.body ?? {};
  db.prepare(
    `UPDATE fields SET name = ?, location = ?, default_duration_minutes = ?, notes = ? WHERE id = ?`
  ).run(name, location ?? null, default_duration_minutes ?? null, notes ?? null, req.params.id);
  res.json({ ok: true });
});

configRouter.delete("/fields/:id", (req, res) => {
  db.prepare(`DELETE FROM fields WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---- Field availability (game times per field) ----
configRouter.post("/fields/:id/availability", (req, res) => {
  const { day_of_week, start_time, end_time } = req.body ?? {};
  if (day_of_week === undefined || !start_time || !end_time) {
    return res.status(400).json({ error: "day_of_week, start_time, end_time are required" });
  }
  const info = db
    .prepare(
      `INSERT INTO field_availability (field_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)`
    )
    .run(req.params.id, day_of_week, start_time, end_time);
  res.status(201).json({ id: info.lastInsertRowid });
});

configRouter.delete("/availability/:id", (req, res) => {
  db.prepare(`DELETE FROM field_availability WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---- Blackout dates ----
configRouter.get("/blackouts", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM blackout_dates ORDER BY date`).all());
});

configRouter.post("/blackouts", (req, res) => {
  const { date, reason } = req.body ?? {};
  if (!date) return res.status(400).json({ error: "date is required" });
  try {
    const info = db
      .prepare(`INSERT INTO blackout_dates (date, reason) VALUES (?, ?)`)
      .run(date, reason ?? null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(400).json({ error: `${date} is already marked as a blackout date` });
  }
});

configRouter.delete("/blackouts/:id", (req, res) => {
  db.prepare(`DELETE FROM blackout_dates WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---- Specific game days (explicit date whitelist) ----
configRouter.get("/game-days", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM game_days ORDER BY date`).all());
});

configRouter.post("/game-days", (req, res) => {
  const { date } = req.body ?? {};
  if (!date) return res.status(400).json({ error: "date is required" });
  try {
    const info = db.prepare(`INSERT INTO game_days (date) VALUES (?)`).run(date);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(400).json({ error: `${date} is already a game day` });
  }
});

configRouter.delete("/game-days/:id", (req, res) => {
  db.prepare(`DELETE FROM game_days WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---- Season config ----
function serializeSeason(row: Record<string, unknown>) {
  return {
    ...row,
    game_days_of_week: row.game_days_of_week ? JSON.parse(row.game_days_of_week as string) : [],
  };
}

configRouter.get("/season", (_req, res) => {
  const row = db.prepare(`SELECT * FROM season_config WHERE id = 1`).get() as Record<string, unknown>;
  res.json(serializeSeason(row));
});

configRouter.put("/season", (req, res) => {
  const {
    season_name,
    start_date,
    end_date,
    games_per_matchup,
    default_game_duration_minutes,
    break_between_games_minutes,
    game_days_of_week,
  } = req.body ?? {};
  db.prepare(
    `UPDATE season_config SET
      season_name = ?, start_date = ?, end_date = ?,
      games_per_matchup = ?, default_game_duration_minutes = ?, break_between_games_minutes = ?,
      game_days_of_week = ?
     WHERE id = 1`
  ).run(
    season_name ?? null,
    start_date ?? null,
    end_date ?? null,
    games_per_matchup ?? 1,
    default_game_duration_minutes ?? 60,
    break_between_games_minutes ?? 15,
    Array.isArray(game_days_of_week) && game_days_of_week.length > 0
      ? JSON.stringify(game_days_of_week)
      : null
  );
  const row = db.prepare(`SELECT * FROM season_config WHERE id = 1`).get() as Record<string, unknown>;
  res.json(serializeSeason(row));
});

// ---- Theme config ----
configRouter.get("/theme", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM theme_config WHERE id = 1`).get());
});

configRouter.put("/theme", (req, res) => {
  const {
    league_name,
    primary_color,
    secondary_color,
    accent_color,
    background_color,
    text_color,
    header_text,
    font_family,
    logo_url,
  } = req.body ?? {};
  db.prepare(
    `UPDATE theme_config SET
      league_name = ?, primary_color = ?, secondary_color = ?, accent_color = ?,
      background_color = ?, text_color = ?, header_text = ?, font_family = ?, logo_url = ?
     WHERE id = 1`
  ).run(
    league_name,
    primary_color,
    secondary_color,
    accent_color,
    background_color,
    text_color,
    header_text,
    font_family,
    logo_url ?? null
  );
  res.json({ ok: true });
});
