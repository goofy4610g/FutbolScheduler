import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Coach, Field, Player, ScheduleBatch, SeasonConfig, Team } from "../types";

export function Dashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [season, setSeason] = useState<SeasonConfig | null>(null);
  const [batches, setBatches] = useState<ScheduleBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Team[]>("/api/teams"),
      api.get<Player[]>("/api/players"),
      api.get<Coach[]>("/api/coaches"),
      api.get<Field[]>("/api/config/fields"),
      api.get<SeasonConfig>("/api/config/season"),
      api.get<ScheduleBatch[]>("/api/schedule/batches"),
    ]).then(([t, p, c, f, s, b]) => {
      setTeams(t);
      setPlayers(p);
      setCoaches(c);
      setFields(f);
      setSeason(s);
      setBatches(b);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Loading dashboard...</p>;

  const seasonConfigured = Boolean(season?.start_date && season?.end_date);

  return (
    <div>
      <h2>Dashboard</h2>

      <div className="grid cols-4">
        <div className="stat">
          <div className="value">{teams.length}</div>
          <div className="label">Teams</div>
        </div>
        <div className="stat">
          <div className="value">{players.length}</div>
          <div className="label">Players</div>
        </div>
        <div className="stat">
          <div className="value">{coaches.length}</div>
          <div className="label">Coaches</div>
        </div>
        <div className="stat">
          <div className="value">{fields.length}</div>
          <div className="label">Fields</div>
        </div>
      </div>

      <div className="card">
        <h3>Getting started</h3>
        <ol>
          <li>
            <Link to="/upload">Upload data</Link> for teams, players, and coaches (CSV or Excel).
          </li>
          <li>
            <Link to="/configuration">Configure</Link> fields, game times/durations, and season
            settings.
          </li>
          <li>
            <Link to="/branding">Customize branding</Link> — colors, logo, header text.
          </li>
          <li>
            <Link to="/schedule">Generate the season schedule</Link> once teams and fields are set up.
          </li>
        </ol>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Season configuration</h3>
          {seasonConfigured ? (
            <>
              <p>
                <strong>{season?.season_name || "Untitled season"}</strong>
              </p>
              <p className="muted">
                {season?.start_date} &rarr; {season?.end_date}
              </p>
              <p className="muted">
                Each team plays every other team {season?.games_per_matchup}x &middot;{" "}
                {season?.default_game_duration_minutes} min games
              </p>
            </>
          ) : (
            <p className="muted">
              Season dates not set yet. Head to <Link to="/configuration">Configuration</Link>.
            </p>
          )}
        </div>

        <div className="card">
          <h3>Recent schedules</h3>
          {batches.length === 0 ? (
            <p className="muted">No schedule generated yet.</p>
          ) : (
            <ul>
              {batches.slice(0, 5).map((b) => (
                <li key={b.id}>
                  {b.season_name || `Batch #${b.id}`} &mdash;{" "}
                  {new Date(b.created_at + "Z").toLocaleString()}
                </li>
              ))}
            </ul>
          )}
          <Link className="btn small" to="/schedule">
            Go to Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}
