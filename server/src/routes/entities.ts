import { Router } from "express";
import { db } from "../db.js";

export const entitiesRouter = Router();

entitiesRouter.get("/teams", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM teams ORDER BY division, name`).all());
});

entitiesRouter.delete("/teams/:id", (req, res) => {
  db.prepare(`DELETE FROM teams WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

entitiesRouter.get("/coaches", (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT coaches.*, teams.name AS team_name
         FROM coaches LEFT JOIN teams ON teams.id = coaches.team_id
         ORDER BY teams.name, coaches.name`
      )
      .all()
  );
});

entitiesRouter.delete("/coaches/:id", (req, res) => {
  db.prepare(`DELETE FROM coaches WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

entitiesRouter.get("/players", (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT players.*, teams.name AS team_name
         FROM players LEFT JOIN teams ON teams.id = players.team_id
         ORDER BY teams.name, players.name`
      )
      .all()
  );
});

entitiesRouter.delete("/players/:id", (req, res) => {
  db.prepare(`DELETE FROM players WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
