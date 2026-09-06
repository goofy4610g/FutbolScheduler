import { Router } from "express";
import { db } from "../db.js";
import { generateSchedule } from "../services/scheduler.js";

export const scheduleRouter = Router();

scheduleRouter.post("/generate", (_req, res) => {
  try {
    const teams = db.prepare(`SELECT id, name, division FROM teams`).all() as Array<{
      id: number;
      name: string;
      division: string | null;
    }>;
    const rawFields = db.prepare(`SELECT id, default_duration_minutes FROM fields`).all() as Array<{
      id: number;
      default_duration_minutes: number | null;
    }>;
    const availability = db.prepare(`SELECT * FROM field_availability`).all() as Array<{
      field_id: number;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
    const fields = rawFields.map((f) => ({
      ...f,
      availability: availability.filter((a) => a.field_id === f.id),
    }));
    const season = db.prepare(`SELECT * FROM season_config WHERE id = 1`).get() as {
      start_date: string;
      end_date: string;
      games_per_matchup: number;
      default_game_duration_minutes: number;
      break_between_games_minutes: number;
    };

    if (teams.length < 2) {
      return res.status(400).json({ error: "At least two teams are required to generate a schedule" });
    }

    const result = generateSchedule(teams, fields, season);

    const batchId = db.transaction(() => {
      const batch = db
        .prepare(`INSERT INTO schedule_batches (season_name) VALUES (?)`)
        .run(season.start_date ? `Season starting ${season.start_date}` : "Untitled season");
      const id = batch.lastInsertRowid as number;

      const insertGame = db.prepare(
        `INSERT INTO games (batch_id, round_number, date, start_time, end_time, field_id, home_team_id, away_team_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const g of result.scheduled) {
        insertGame.run(id, g.round_number, g.date, g.start_time, g.end_time, g.field_id, g.home_team_id, g.away_team_id);
      }
      return id;
    })();

    res.json({ batchId, scheduledCount: result.scheduled.length, unscheduled: result.unscheduled });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to generate schedule" });
  }
});

scheduleRouter.get("/batches", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM schedule_batches ORDER BY id DESC`).all());
});

scheduleRouter.get("/batches/:id/games", (req, res) => {
  const games = db
    .prepare(
      `SELECT games.*, home.name AS home_team_name, away.name AS away_team_name, fields.name AS field_name
       FROM games
       JOIN teams home ON home.id = games.home_team_id
       JOIN teams away ON away.id = games.away_team_id
       LEFT JOIN fields ON fields.id = games.field_id
       WHERE batch_id = ?
       ORDER BY date, start_time`
    )
    .all(req.params.id);
  res.json(games);
});

scheduleRouter.delete("/batches/:id", (req, res) => {
  db.prepare(`DELETE FROM schedule_batches WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
