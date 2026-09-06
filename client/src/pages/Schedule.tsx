import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Game, GenerateScheduleResult, ScheduleBatch, Team } from "../types";

export function Schedule() {
  const [batches, setBatches] = useState<ScheduleBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBatches = async () => {
    const b = await api.get<ScheduleBatch[]>("/api/schedule/batches");
    setBatches(b);
    if (b.length > 0 && selectedBatch === null) setSelectedBatch(b[0].id);
  };

  useEffect(() => {
    loadBatches();
    api.get<Team[]>("/api/teams").then(setTeams);
  }, []);

  useEffect(() => {
    if (selectedBatch !== null) {
      api.get<Game[]>(`/api/schedule/batches/${selectedBatch}/games`).then(setGames);
    } else {
      setGames([]);
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

  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `#${id}`;

  return (
    <div>
      <h2>Schedule</h2>

      <div className="card">
        <h3>Generate a schedule</h3>
        <p className="muted">
          Builds a round-robin schedule from your configured teams, fields, game times, and season
          settings. Each generation creates a new schedule batch you can review or delete.
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
