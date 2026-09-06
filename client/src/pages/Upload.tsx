import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Coach, EntityType, ImportResult, Player, PreviewResult, Team } from "../types";

const ENTITY_LABELS: Record<EntityType, string> = {
  teams: "Teams",
  players: "Players",
  coaches: "Coaches",
};

const EXPECTED_COLUMNS: Record<EntityType, string> = {
  teams: "name (required), division, notes",
  coaches: "name (required), email, phone, team (must match an existing team name)",
  players: "name (required), team (must match an existing team name), jersey_number, position, birth_date",
};

export function Upload() {
  const [entityType, setEntityType] = useState<EntityType>("teams");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);

  const reloadEntities = useCallback(async () => {
    const [t, p, c] = await Promise.all([
      api.get<Team[]>("/api/teams"),
      api.get<Player[]>("/api/players"),
      api.get<Coach[]>("/api/coaches"),
    ]);
    setTeams(t);
    setPlayers(p);
    setCoaches(c);
  }, []);

  useEffect(() => {
    reloadEntities();
  }, [reloadEntities]);

  async function handleFile(selected: File) {
    setFile(selected);
    setResult(null);
    setError(null);
    setPreview(null);
    const formData = new FormData();
    formData.append("file", selected);
    try {
      const data = await api.post<PreviewResult>("/api/upload/preview", formData);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview file");
    }
  }

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);
    try {
      const data = await api.post<ImportResult>("/api/upload", formData);
      setResult(data);
      setFile(null);
      setPreview(null);
      await reloadEntities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntity(type: EntityType, id: number) {
    await api.delete(`/api/${type}/${id}`);
    await reloadEntities();
  }

  return (
    <div>
      <h2>Data Upload</h2>
      <p className="muted">
        Upload a CSV, TSV, or Excel (.xlsx) file containing teams, players, or coaches. Teams should
        be uploaded first so players and coaches can be linked to them by name.
      </p>

      <div className="card">
        <div className="tabs">
          {(Object.keys(ENTITY_LABELS) as EntityType[]).map((type) => (
            <button
              key={type}
              className={type === entityType ? "active" : ""}
              onClick={() => {
                setEntityType(type);
                setFile(null);
                setPreview(null);
                setResult(null);
                setError(null);
              }}
            >
              {ENTITY_LABELS[type]}
            </button>
          ))}
        </div>

        <p className="muted">Expected columns for {ENTITY_LABELS[entityType]}: {EXPECTED_COLUMNS[entityType]}</p>

        <div
          className={`dropzone ${dragActive ? "active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFile(dropped);
          }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          {file ? <strong>{file.name}</strong> : "Drag a file here, or click to choose one"}
          <input
            id="file-input"
            type="file"
            accept=".csv,.tsv,.txt,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFile(selected);
            }}
          />
        </div>

        {error && <div className="banner error" style={{ marginTop: "1rem" }}>{error}</div>}

        {preview && (
          <div style={{ marginTop: "1rem" }}>
            <p className="muted">
              Detected {preview.totalRows} row(s) with columns: {preview.columns.join(", ")}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    {preview.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map((c) => (
                        <td key={c}>{row[c]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn" style={{ marginTop: "1rem" }} disabled={busy} onClick={handleImport}>
              {busy ? "Importing..." : `Import ${preview.totalRows} row(s) as ${ENTITY_LABELS[entityType]}`}
            </button>
          </div>
        )}

        {result && (
          <div className="banner success" style={{ marginTop: "1rem" }}>
            Imported {ENTITY_LABELS[result.entityType]}: {result.inserted} added, {result.updated} updated
            {result.skipped.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                {result.skipped.length} row(s) skipped:
                <ul>
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Teams ({teams.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Division</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.division}</td>
                  <td>
                    <button className="btn danger small" onClick={() => deleteEntity("teams", t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Coaches ({coaches.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Team</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.team_name}</td>
                  <td>
                    <button className="btn danger small" onClick={() => deleteEntity("coaches", c.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Players ({players.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Jersey #</th>
              <th>Position</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.team_name}</td>
                <td>{p.jersey_number}</td>
                <td>{p.position}</td>
                <td>
                  <button className="btn danger small" onClick={() => deleteEntity("players", p.id)}>
                    Delete
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
