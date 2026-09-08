import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { BlackoutDate, Field, GameDay, SeasonConfig } from "../types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STEPS = ["Fields & Game Times", "Season Settings", "Game Days", "Blackout Dates", "Review"];

export function Configuration() {
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [season, setSeason] = useState<SeasonConfig | null>(null);
  const [gameDays, setGameDays] = useState<GameDay[]>([]);
  const [blackouts, setBlackouts] = useState<BlackoutDate[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadFields = async () => setFields(await api.get<Field[]>("/api/config/fields"));
  const reloadGameDays = async () => setGameDays(await api.get<GameDay[]>("/api/config/game-days"));
  const reloadBlackouts = async () => setBlackouts(await api.get<BlackoutDate[]>("/api/config/blackouts"));

  useEffect(() => {
    Promise.all([
      api.get<Field[]>("/api/config/fields"),
      api.get<SeasonConfig>("/api/config/season"),
      api.get<GameDay[]>("/api/config/game-days"),
      api.get<BlackoutDate[]>("/api/config/blackouts"),
    ]).then(([f, s, g, b]) => {
      setFields(f);
      setSeason(s);
      setGameDays(g);
      setBlackouts(b);
      setLoading(false);
    });
  }, []);

  if (loading || !season) return <p>Loading configuration...</p>;

  return (
    <div>
      <h2>Configuration</h2>
      <div className="stepper">
        {STEPS.map((label, i) => (
          <div key={label} className={`step ${i === step ? "active" : i < step ? "done" : ""}`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 0 && <FieldsStep fields={fields} onChange={reloadFields} />}
      {step === 1 && <SeasonStep season={season} onSave={setSeason} />}
      {step === 2 && <GameDaysStep season={season} onSaveSeason={setSeason} gameDays={gameDays} onChangeGameDays={reloadGameDays} />}
      {step === 3 && <BlackoutStep blackouts={blackouts} onChange={reloadBlackouts} />}
      {step === 4 && <ReviewStep fields={fields} season={season} gameDays={gameDays} blackouts={blackouts} />}

      <div className="row" style={{ marginTop: "1.5rem" }}>
        <button className="btn secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button className="btn" onClick={() => setStep((s) => s + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function FieldsStep({ fields, onChange }: { fields: Field[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addField(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await api.post("/api/config/fields", {
        name,
        location: location || null,
        default_duration_minutes: duration ? Number(duration) : null,
      });
      setName("");
      setLocation("");
      setDuration("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add field");
    }
  }

  return (
    <div>
      <div className="card">
        <h3>Add a field</h3>
        <form onSubmit={addField}>
          <div className="row">
            <div className="field">
              <label>Field name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Field 1" required />
            </div>
            <div className="field">
              <label>Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City Park" />
            </div>
            <div className="field">
              <label>Default game duration (min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Uses season default"
              />
            </div>
          </div>
          {error && <div className="banner error">{error}</div>}
          <button className="btn" type="submit">
            Add field
          </button>
        </form>
      </div>

      {fields.map((field) => (
        <FieldCard key={field.id} field={field} onChange={onChange} />
      ))}
    </div>
  );
}

function FieldCard({ field, onChange }: { field: Field; onChange: () => void }) {
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  async function addAvailability(e: FormEvent) {
    e.preventDefault();
    await api.post(`/api/config/fields/${field.id}/availability`, {
      day_of_week: Number(day),
      start_time: start,
      end_time: end,
    });
    onChange();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <h3 style={{ marginBottom: 0 }}>{field.name}</h3>
          <p className="muted" style={{ marginTop: "0.2rem" }}>
            {field.location || "No location set"} &middot;{" "}
            {field.default_duration_minutes ? `${field.default_duration_minutes} min games` : "Uses season default duration"}
          </p>
        </div>
        <button
          className="btn danger small"
          onClick={async () => {
            await api.delete(`/api/config/fields/${field.id}`);
            onChange();
          }}
        >
          Delete field
        </button>
      </div>

      <table style={{ marginBottom: "0.75rem" }}>
        <thead>
          <tr>
            <th>Day</th>
            <th>Start</th>
            <th>End</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {field.availability.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No available game times yet.
              </td>
            </tr>
          )}
          {field.availability.map((a) => (
            <tr key={a.id}>
              <td>{DAYS[a.day_of_week]}</td>
              <td>{a.start_time}</td>
              <td>{a.end_time}</td>
              <td>
                <button
                  className="btn secondary small"
                  onClick={async () => {
                    await api.delete(`/api/config/availability/${a.id}`);
                    onChange();
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={addAvailability} className="row">
        <div className="field">
          <label>Day</label>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Start time</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="field">
          <label>End time</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
        <button className="btn secondary" type="submit">
          Add time window
        </button>
      </form>
    </div>
  );
}

function SeasonStep({ season, onSave }: { season: SeasonConfig; onSave: (s: SeasonConfig) => void }) {
  const [form, setForm] = useState(season);
  const [saved, setSaved] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    await api.put("/api/config/season", form);
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card">
      <h3>Season settings</h3>
      <form onSubmit={save}>
        <div className="field">
          <label>Season name</label>
          <input
            type="text"
            value={form.season_name ?? ""}
            onChange={(e) => setForm({ ...form, season_name: e.target.value })}
            placeholder="Fall 2026 Season"
          />
        </div>
        <div className="row">
          <div className="field">
            <label>Start date</label>
            <input
              type="date"
              value={form.start_date ?? ""}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="field">
            <label>End date</label>
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>
        <p className="muted">
          Leave dates blank if you'll define specific game days instead, on the next step.
        </p>
        <div className="row">
          <div className="field">
            <label>Times each team plays every other team</label>
            <input
              type="number"
              min={1}
              value={form.games_per_matchup}
              onChange={(e) => setForm({ ...form, games_per_matchup: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Default game duration (minutes)</label>
            <input
              type="number"
              min={10}
              value={form.default_game_duration_minutes}
              onChange={(e) => setForm({ ...form, default_game_duration_minutes: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Break between games (minutes)</label>
            <input
              type="number"
              min={0}
              value={form.break_between_games_minutes}
              onChange={(e) => setForm({ ...form, break_between_games_minutes: Number(e.target.value) })}
            />
          </div>
        </div>
        <button className="btn" type="submit">
          Save season settings
        </button>
        {saved && <span className="banner success" style={{ marginLeft: "1rem", display: "inline-block" }}>Saved</span>}
      </form>
    </div>
  );
}

function GameDaysStep({
  season,
  onSaveSeason,
  gameDays,
  onChangeGameDays,
}: {
  season: SeasonConfig;
  onSaveSeason: (s: SeasonConfig) => void;
  gameDays: GameDay[];
  onChangeGameDays: () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>(season.game_days_of_week);
  const [savedWeekdays, setSavedWeekdays] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    );
  }

  async function saveWeekdays() {
    const updated = { ...season, game_days_of_week: selectedDays };
    const saved = await api.put<SeasonConfig>("/api/config/season", updated);
    onSaveSeason(saved);
    setSavedWeekdays(true);
    setTimeout(() => setSavedWeekdays(false), 2000);
  }

  async function addGameDay(e: FormEvent) {
    e.preventDefault();
    if (!date) return;
    setError(null);
    try {
      await api.post("/api/config/game-days", { date });
      setDate("");
      onChangeGameDays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add game day");
    }
  }

  return (
    <div>
      <div className="card">
        <h3>Recurring game days</h3>
        <p className="muted">
          Restrict the whole season to certain days of the week (e.g. only Saturday and Sunday), on top
          of each field's own available time windows. Leave none selected to allow any day a field is
          available.
        </p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {DAYS.map((d, i) => (
            <label
              key={d}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontWeight: 400,
                flex: "0 0 auto",
                minWidth: "auto",
              }}
            >
              <input type="checkbox" checked={selectedDays.includes(i)} onChange={() => toggleDay(i)} />
              {d}
            </label>
          ))}
        </div>
        <button className="btn" style={{ marginTop: "1rem" }} onClick={saveWeekdays}>
          Save recurring game days
        </button>
        {savedWeekdays && (
          <span className="banner success" style={{ marginLeft: "1rem", display: "inline-block" }}>
            Saved
          </span>
        )}
      </div>

      <div className="card">
        <h3>Specific game days</h3>
        <p className="muted">
          Add exact dates games are allowed on. When any specific game days are set, the scheduler uses
          only these dates instead of every matching weekday in the season range &mdash; useful for bye
          weeks or an irregular calendar.
        </p>
        <form onSubmit={addGameDay} className="row">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <button className="btn secondary" type="submit">
            Add game day
          </button>
        </form>
        {error && <div className="banner error">{error}</div>}

        <table style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gameDays.length === 0 && (
              <tr>
                <td colSpan={2} className="muted">
                  No specific game days added &mdash; the season date range and recurring days above will
                  be used instead.
                </td>
              </tr>
            )}
            {gameDays.map((g) => (
              <tr key={g.id}>
                <td>{g.date}</td>
                <td>
                  <button
                    className="btn secondary small"
                    onClick={async () => {
                      await api.delete(`/api/config/game-days/${g.id}`);
                      onChangeGameDays();
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BlackoutStep({ blackouts, onChange }: { blackouts: BlackoutDate[]; onChange: () => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addBlackout(e: FormEvent) {
    e.preventDefault();
    if (!date) return;
    setError(null);
    try {
      await api.post("/api/config/blackouts", { date, reason: reason || null });
      setDate("");
      setReason("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add blackout date");
    }
  }

  return (
    <div className="card">
      <h3>Blackout dates</h3>
      <p className="muted">
        Dates the scheduler should skip entirely (holidays, tournaments, facility closures).
      </p>
      <form onSubmit={addBlackout} className="row">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Reason (optional)</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Holiday weekend" />
        </div>
        <button className="btn secondary" type="submit">
          Add blackout date
        </button>
      </form>
      {error && <div className="banner error">{error}</div>}

      <table style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Reason</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {blackouts.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No blackout dates yet.
              </td>
            </tr>
          )}
          {blackouts.map((b) => (
            <tr key={b.id}>
              <td>{b.date}</td>
              <td>{b.reason}</td>
              <td>
                <button
                  className="btn secondary small"
                  onClick={async () => {
                    await api.delete(`/api/config/blackouts/${b.id}`);
                    onChange();
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewStep({
  fields,
  season,
  gameDays,
  blackouts,
}: {
  fields: Field[];
  season: SeasonConfig;
  gameDays: GameDay[];
  blackouts: BlackoutDate[];
}) {
  const totalWindows = fields.reduce((sum, f) => sum + f.availability.length, 0);
  const hasDateRange = Boolean(season.start_date && season.end_date) || gameDays.length > 0;
  const ready = fields.length > 0 && totalWindows > 0 && hasDateRange;

  return (
    <div className="card">
      <h3>Review</h3>
      <p>
        <strong>{fields.length}</strong> field(s) configured with <strong>{totalWindows}</strong> total
        available time window(s).
      </p>
      <p>
        Season: <strong>{season.season_name || "Untitled"}</strong> from {season.start_date || "?"} to{" "}
        {season.end_date || "?"}, each matchup played {season.games_per_matchup}x.
      </p>
      <p>
        {gameDays.length > 0 ? (
          <>
            <strong>{gameDays.length}</strong> specific game day(s) will be used instead of the season date
            range.
          </>
        ) : season.game_days_of_week.length > 0 ? (
          <>
            Games are restricted to{" "}
            <strong>{season.game_days_of_week.map((d) => DAYS[d]).join(", ")}</strong>.
          </>
        ) : (
          <>No recurring game day restriction &mdash; any day a field is available may be used.</>
        )}
      </p>
      <p>
        <strong>{blackouts.length}</strong> blackout date(s) will be skipped when generating the schedule.
      </p>
      {ready ? (
        <div className="banner success">
          Configuration looks complete. You're ready to <Link to="/upload">load your data</Link> (if you
          haven't already) and then <Link to="/schedule">generate the schedule</Link>.
        </div>
      ) : (
        <div className="banner info">
          Add at least one field with a time window, and either set season start/end dates or add specific
          game days, to enable schedule generation.
        </div>
      )}
    </div>
  );
}
