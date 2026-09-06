import { Router } from "express";
import multer from "multer";
import { db } from "../db.js";
import { parseSpreadsheetFile } from "../services/parser.js";
import type { EntityType, ImportResult, ParsedRow } from "../types.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const uploadRouter = Router();

function firstMatch(row: ParsedRow, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value) return value;
  }
  return "";
}

function findTeamId(teamName: string): number | null {
  if (!teamName) return null;
  const team = db
    .prepare(`SELECT id FROM teams WHERE lower(name) = lower(?)`)
    .get(teamName) as { id: number } | undefined;
  return team ? team.id : null;
}

function importTeams(rows: ParsedRow[]): ImportResult {
  const result: ImportResult = { entityType: "teams", inserted: 0, updated: 0, skipped: [] };
  const upsert = db.prepare(`
    INSERT INTO teams (name, division, notes) VALUES (@name, @division, @notes)
    ON CONFLICT(name) DO UPDATE SET division = excluded.division, notes = excluded.notes
  `);
  const existing = db.prepare(`SELECT id FROM teams WHERE lower(name) = lower(?)`);

  rows.forEach((row, index) => {
    const name = firstMatch(row, ["name", "team", "team_name"]);
    if (!name) {
      result.skipped.push({ row: index + 2, reason: "Missing team name" });
      return;
    }
    const wasExisting = existing.get(name);
    upsert.run({
      name,
      division: firstMatch(row, ["division", "age_group", "bracket"]) || null,
      notes: firstMatch(row, ["notes", "comment", "comments"]) || null,
    });
    if (wasExisting) result.updated++;
    else result.inserted++;
  });

  return result;
}

function importCoaches(rows: ParsedRow[]): ImportResult {
  const result: ImportResult = { entityType: "coaches", inserted: 0, updated: 0, skipped: [] };
  const findExisting = db.prepare(
    `SELECT id FROM coaches WHERE lower(name) = lower(?) AND team_id IS ?`
  );
  const insert = db.prepare(
    `INSERT INTO coaches (name, email, phone, team_id) VALUES (?, ?, ?, ?)`
  );
  const update = db.prepare(`UPDATE coaches SET email = ?, phone = ? WHERE id = ?`);

  rows.forEach((row, index) => {
    const name = firstMatch(row, ["name", "coach", "coach_name"]);
    if (!name) {
      result.skipped.push({ row: index + 2, reason: "Missing coach name" });
      return;
    }
    const teamName = firstMatch(row, ["team", "team_name"]);
    const teamId = findTeamId(teamName);
    if (teamName && teamId === null) {
      result.skipped.push({ row: index + 2, reason: `No team found named "${teamName}"` });
      return;
    }
    const email = firstMatch(row, ["email"]) || null;
    const phone = firstMatch(row, ["phone", "phone_number"]) || null;

    const existing = findExisting.get(name, teamId) as { id: number } | undefined;
    if (existing) {
      update.run(email, phone, existing.id);
      result.updated++;
    } else {
      insert.run(name, email, phone, teamId);
      result.inserted++;
    }
  });

  return result;
}

function importPlayers(rows: ParsedRow[]): ImportResult {
  const result: ImportResult = { entityType: "players", inserted: 0, updated: 0, skipped: [] };
  const findExisting = db.prepare(
    `SELECT id FROM players WHERE lower(name) = lower(?) AND team_id IS ?`
  );
  const insert = db.prepare(
    `INSERT INTO players (name, team_id, jersey_number, position, birth_date) VALUES (?, ?, ?, ?, ?)`
  );
  const update = db.prepare(
    `UPDATE players SET jersey_number = ?, position = ?, birth_date = ? WHERE id = ?`
  );

  rows.forEach((row, index) => {
    const name = firstMatch(row, ["name", "player", "player_name"]);
    if (!name) {
      result.skipped.push({ row: index + 2, reason: "Missing player name" });
      return;
    }
    const teamName = firstMatch(row, ["team", "team_name"]);
    const teamId = findTeamId(teamName);
    if (teamName && teamId === null) {
      result.skipped.push({ row: index + 2, reason: `No team found named "${teamName}"` });
      return;
    }
    const jersey = firstMatch(row, ["jersey_number", "jersey", "number"]) || null;
    const position = firstMatch(row, ["position", "pos"]) || null;
    const birthDate = firstMatch(row, ["birth_date", "dob", "birthdate"]) || null;

    const existing = findExisting.get(name, teamId) as { id: number } | undefined;
    if (existing) {
      update.run(jersey, position, birthDate, existing.id);
      result.updated++;
    } else {
      insert.run(name, teamId, jersey, position, birthDate);
      result.inserted++;
    }
  });

  return result;
}

uploadRouter.post("/", upload.single("file"), async (req, res) => {
  const entityType = req.body?.entityType as EntityType | undefined;
  if (!entityType || !["teams", "players", "coaches"].includes(entityType)) {
    return res.status(400).json({ error: "entityType must be one of teams, players, coaches" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const rows = await parseSpreadsheetFile(req.file.buffer, req.file.originalname);
    if (rows.length === 0) {
      return res.status(400).json({ error: "File contained no data rows" });
    }

    let result: ImportResult;
    const runImport = db.transaction(() => {
      if (entityType === "teams") result = importTeams(rows);
      else if (entityType === "coaches") result = importCoaches(rows);
      else result = importPlayers(rows);
    });
    runImport();

    res.json(result!);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse file" });
  }
});

uploadRouter.post("/preview", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const rows = await parseSpreadsheetFile(req.file.buffer, req.file.originalname);
    res.json({ columns: rows.length ? Object.keys(rows[0]) : [], rows: rows.slice(0, 20), totalRows: rows.length });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse file" });
  }
});
