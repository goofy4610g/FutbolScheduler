import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Field, SeasonConfig } from "../types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STEPS = ["Fields & Game Times", "Season Settings", "Review"];

export function Configuration() {
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [season, setSeason] = useState<SeasonConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadFields = async () => setFields(await api.get<Field[]>("/api/config/fields"));

  useEffect(() => {
    Promise.all([api.get<Field[]>("/api/config/fields"), api.get<SeasonConfig>("/api/config/season")]).then(
      ([f, s]) => {
        setFields(f);
        setSeason(s);
        setLoading(false);
      }
    );
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
      {step === 2 && <ReviewStep fields={fields} season={season} />}

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
              required
            />
          </div>
          <div className="field">
            <label>End date</label>
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </div>
        </div>
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

function ReviewStep({ fields, season }: { fields: Field[]; season: SeasonConfig }) {
  const totalWindows = fields.reduce((sum, f) => sum + f.availability.length, 0);
  const ready = fields.length > 0 && totalWindows > 0 && Boolean(season.start_date && season.end_date);

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
      {ready ? (
        <div className="banner success">
          Configuration looks complete. You're ready to <Link to="/upload">load your data</Link> (if you
          haven't already) and then <Link to="/schedule">generate the schedule</Link>.
        </div>
      ) : (
        <div className="banner info">
          Add at least one field with a time window, and set season start/end dates, to enable schedule
          generation.
        </div>
      )}
    </div>
  );
}
