import { Router } from "express";
import { db } from "../db.js";
import { buildIcsCalendar } from "../services/ics.js";
import { generateSchedule } from "../services/scheduler.js";

export const scheduleRouter = Router();

interface GameRow {
  id: number;
  batch_id: number;
  round_number: number;
  date: string;
  start_time: string;
  end_time: string;
  field_id: number | null;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  home_team_name: string;
  away_team_name: string;
  field_name: string | null;
}

function gamesForBatch(batchId: string | number): GameRow[] {
  return db
    .prepare(
      `SELECT games.*, home.name AS home_team_name, away.name AS away_team_name, fields.name AS field_name
       FROM games
       JOIN teams home ON home.id = games.home_team_id
       JOIN teams away ON away.id = games.away_team_id
       LEFT JOIN fields ON fields.id = games.field_id
       WHERE batch_id = ?
       ORDER BY date, start_time`
    )
    .all(batchId) as GameRow[];
}

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
    const seasonRow = db.prepare(`SELECT * FROM season_config WHERE id = 1`).get() as {
      start_date: string;
      end_date: string;
      games_per_matchup: number;
      default_game_duration_minutes: number;
      break_between_games_minutes: number;
      game_days_of_week: string | null;
    };
    const season = {
      ...seasonRow,
      game_days_of_week: seasonRow.game_days_of_week ? (JSON.parse(seasonRow.game_days_of_week) as number[]) : [],
    };
    const blackoutDates = (db.prepare(`SELECT date FROM blackout_dates`).all() as Array<{ date: string }>).map(
      (b) => b.date
    );
    const gameDays = (db.prepare(`SELECT date FROM game_days`).all() as Array<{ date: string }>).map(
      (g) => g.date
    );

    if (teams.length < 2) {
      return res.status(400).json({ error: "At least two teams are required to generate a schedule" });
    }

    const result = generateSchedule(teams, fields, season, blackoutDates, gameDays);

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
  res.json(gamesForBatch(req.params.id));
});

scheduleRouter.delete("/batches/:id", (req, res) => {
  db.prepare(`DELETE FROM schedule_batches WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---- Scores ----
scheduleRouter.put("/games/:id/score", (req, res) => {
  const { home_score, away_score } = req.body ?? {};
  const homeScore = home_score === null || home_score === "" ? null : Number(home_score);
  const awayScore = away_score === null || away_score === "" ? null : Number(away_score);
  if ((homeScore !== null && Number.isNaN(homeScore)) || (awayScore !== null && Number.isNaN(awayScore))) {
    return res.status(400).json({ error: "Scores must be numbers" });
  }
  db.prepare(`UPDATE games SET home_score = ?, away_score = ? WHERE id = ?`).run(
    homeScore,
    awayScore,
    req.params.id
  );
  res.json({ ok: true });
});

// ---- Standings ----
scheduleRouter.get("/batches/:id/standings", (req, res) => {
  const games = gamesForBatch(req.params.id);
  const teams = db.prepare(`SELECT id, name, division FROM teams`).all() as Array<{
    id: number;
    name: string;
    division: string | null;
  }>;
  const teamById = new Map(teams.map((t) => [t.id, t]));

  interface Stat {
    team_id: number;
    team_name: string;
    division: string | null;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    points: number;
  }

  const stats = new Map<number, Stat>();
  const getStat = (teamId: number): Stat => {
    if (!stats.has(teamId)) {
      const team = teamById.get(teamId);
      stats.set(teamId, {
        team_id: teamId,
        team_name: team?.name ?? `#${teamId}`,
        division: team?.division ?? null,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
      });
    }
    return stats.get(teamId)!;
  };

  // ensure every team appears even with zero games played
  for (const team of teams) getStat(team.id);

  for (const game of games) {
    if (game.home_score === null || game.away_score === null) continue;
    const home = getStat(game.home_team_id);
    const away = getStat(game.away_team_id);
    home.played++;
    away.played++;
    home.goals_for += game.home_score;
    home.goals_against += game.away_score;
    away.goals_for += game.away_score;
    away.goals_against += game.home_score;

    if (game.home_score > game.away_score) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (game.home_score < game.away_score) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points += 1;
      away.points += 1;
    }
  }

  const byDivision = new Map<string, Stat[]>();
  for (const stat of stats.values()) {
    const key = stat.division ?? "Unassigned";
    if (!byDivision.has(key)) byDivision.set(key, []);
    byDivision.get(key)!.push(stat);
  }

  const result = Array.from(byDivision.entries())
    .map(([division, teamStats]) => ({
      division,
      teams: teamStats.sort(
        (a, b) =>
          b.points - a.points ||
          b.goals_for - b.goals_against - (a.goals_for - a.goals_against) ||
          b.goals_for - a.goals_for
      ),
    }))
    .sort((a, b) => a.division.localeCompare(b.division));

  res.json(result);
});

// ---- CSV export ----
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

scheduleRouter.get("/batches/:id/export.csv", (req, res) => {
  const games = gamesForBatch(req.params.id);
  const header = ["Round", "Date", "Start", "End", "Field", "Home", "Away", "Home Score", "Away Score"];
  const rows = games.map((g) => [
    String(g.round_number),
    g.date,
    g.start_time,
    g.end_time,
    g.field_name ?? "",
    g.home_team_name,
    g.away_team_name,
    g.home_score === null ? "" : String(g.home_score),
    g.away_score === null ? "" : String(g.away_score),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="schedule-batch-${req.params.id}.csv"`);
  res.send(csv);
});

// ---- ICS calendar feeds ----
scheduleRouter.get("/batches/:id/calendar.ics", (req, res) => {
  const games = gamesForBatch(req.params.id);
  const teamId = req.query.team ? Number(req.query.team) : null;
  const filtered = teamId
    ? games.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId)
    : games;
  const teamName = teamId
    ? (db.prepare(`SELECT name FROM teams WHERE id = ?`).get(teamId) as { name: string } | undefined)?.name
    : null;

  const ics = buildIcsCalendar(teamName ? `${teamName} Schedule` : "Season Schedule", filtered.map((g) => ({
    uid: `game-${g.id}`,
    date: g.date,
    start_time: g.start_time,
    end_time: g.end_time,
    summary: `${g.home_team_name} vs ${g.away_team_name}`,
    location: g.field_name,
  })));

  res.setHeader("Content-Type", "text/calendar");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${teamName ? teamName.replace(/[^a-z0-9]+/gi, "-") : "season"}-schedule.ics"`
  );
  res.send(ics);
});
