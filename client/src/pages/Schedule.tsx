import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Game, GenerateScheduleResult, ScheduleBatch, StandingsDivision, Team } from "../types";

export function Schedule() {
  const [batches, setBatches] = useState<ScheduleBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [standings, setStandings] = useState<StandingsDivision[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamForCalendar, setSelectedTeamForCalendar] = useState<string>("");

  const loadBatches = async () => {
    const b = await api.get<ScheduleBatch[]>("/api/schedule/batches");
    setBatches(b);
    if (b.length > 0 && selectedBatch === null) setSelectedBatch(b[0].id);
  };

  const loadBatchDetails = async (batchId: number) => {
    const [g, s] = await Promise.all([
      api.get<Game[]>(`/api/schedule/batches/${batchId}/games`),
      api.get<StandingsDivision[]>(`/api/schedule/batches/${batchId}/standings`),
    ]);
    setGames(g);
    setStandings(s);
  };

  useEffect(() => {
    loadBatches();
    api.get<Team[]>("/api/teams").then(setTeams);
  }, []);

  useEffect(() => {
    if (selectedBatch !== null) {
      loadBatchDetails(selectedBatch);
    } else {
      setGames([]);
      setStandings([]);
    }
  }, [selectedBatch]);

  async function generate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.post<GenerateScheduleResult>("/api/schedule/generate");
      setResult(data);
      await loadBatches();
      setSelectedBatch(data.batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate schedule");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteBatch(id: number) {
    await api.delete(`/api/schedule/batches/${id}`);
    setSelectedBatch(null);
    await loadBatches();
  }

  async function saveScore(gameId: number, homeScore: string, awayScore: string) {
    await api.put(`/api/schedule/games/${gameId}/score`, {
      home_score: homeScore === "" ? null : Number(homeScore),
      away_score: awayScore === "" ? null : Number(awayScore),
    });
    if (selectedBatch !== null) await loadBatchDetails(selectedBatch);
  }

  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `#${id}`;

  return (
    <div>
      <div className="no-print">
        <h2>Schedule</h2>

        <div className="card">
          <h3>Generate a schedule</h3>
          <p className="muted">
            Builds a round-robin schedule from your configured teams, fields, game times, season
            settings, and blackout dates. Each generation creates a new schedule batch you can review
            or delete.
          </p>
          <button className="btn" onClick={generate} disabled={generating}>
            {generating ? "Generating..." : "Generate Schedule"}
          </button>

          {error && <div className="banner error" style={{ marginTop: "1rem" }}>{error}</div>}

          {result && (
            <div className="banner success" style={{ marginTop: "1rem" }}>
              Scheduled {result.scheduledCount} game(s).
              {result.unscheduled.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  {result.unscheduled.length} matchup(s) could not be scheduled — add more fields or
                  available time windows, or reduce games per matchup, then regenerate.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ alignItems: "center" }}>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Schedule batch</label>
              <select
                value={selectedBatch ?? ""}
                onChange={(e) => setSelectedBatch(e.target.value ? Number(e.target.value) : null)}
              >
                {batches.length === 0 && <option value="">No schedules yet</option>}
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.season_name || `Batch #${b.id}`} ({new Date(b.created_at + "Z").toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            {selectedBatch !== null && (
              <button className="btn danger small" onClick={() => deleteBatch(selectedBatch)}>
                Delete this batch
              </button>
            )}
          </div>

          {selectedBatch !== null && games.length > 0 && (
            <div className="row" style={{ marginTop: "0.75rem", alignItems: "center" }}>
              <button className="btn secondary small" onClick={() => window.print()}>
                Print schedule
              </button>
              <a className="btn secondary small" href={`/api/schedule/batches/${selectedBatch}/export.csv`}>
                Download CSV
              </a>
              <div className="field" style={{ maxWidth: 220, margin: 0 }}>
                <select value={selectedTeamForCalendar} onChange={(e) => setSelectedTeamForCalendar(e.target.value)}>
                  <option value="">Whole season</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <a
                className="btn secondary small"
                href={`/api/schedule/batches/${selectedBatch}/calendar.ics${
                  selectedTeamForCalendar ? `?team=${selectedTeamForCalendar}` : ""
                }`}
              >
                Subscribe (.ics)
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="card print-area">
        <h3>Games</h3>
        {games.length === 0 ? (
          <p className="muted">No games to display.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>Date</th>
                <th>Time</th>
                <th>Field</th>
                <th>Home</th>
                <th>Away</th>
                <th className="no-print">Score</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td>{g.round_number}</td>
                  <td>{g.date}</td>
                  <td>
                    {g.start_time}&ndash;{g.end_time}
                  </td>
                  <td>{g.field_name}</td>
                  <td>{g.home_team_name || teamName(g.home_team_id)}</td>
                  <td>{g.away_team_name || teamName(g.away_team_id)}</td>
                  <td className="no-print">
                    <ScoreEditor game={g} onSave={saveScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {standings.length > 0 && (
        <div className="card print-area">
          <h3>Standings</h3>
          {standings.map((division) => (
            <div key={division.division} style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ marginBottom: "0.4rem" }}>{division.division}</h4>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>P</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {division.teams.map((t) => (
                    <tr key={t.team_id}>
                      <td>{t.team_name}</td>
                      <td>{t.played}</td>
                      <td>{t.wins}</td>
                      <td>{t.draws}</td>
                      <td>{t.losses}</td>
                      <td>{t.goals_for}</td>
                      <td>{t.goals_against}</td>
                      <td>{t.goals_for - t.goals_against}</td>
                      <td>
                        <strong>{t.points}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreEditor({
  game,
  onSave,
}: {
  game: Game;
  onSave: (gameId: number, home: string, away: string) => void;
}) {
  const [home, setHome] = useState(game.home_score === null ? "" : String(game.home_score));
  const [away, setAway] = useState(game.away_score === null ? "" : String(game.away_score));

  return (
    <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
      <input
        type="number"
        min={0}
        style={{ width: 55 }}
        value={home}
        onChange={(e) => setHome(e.target.value)}
        onBlur={() => onSave(game.id, home, away)}
      />
      <span>&ndash;</span>
      <input
        type="number"
        min={0}
        style={{ width: 55 }}
        value={away}
        onChange={(e) => setAway(e.target.value)}
        onBlur={() => onSave(game.id, home, away)}
      />
    </div>
  );
}
