import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import type { ThemeConfig } from "../types";

const FONT_OPTIONS = [
  { label: "System default", value: "system-ui, sans-serif" },
  { label: "Classic serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Rounded", value: "'Trebuchet MS', Verdana, sans-serif" },
  { label: "Condensed", value: "'Arial Narrow', Arial, sans-serif" },
];

export function Branding() {
  const { theme, refresh } = useTheme();
  const [form, setForm] = useState<ThemeConfig | null>(theme);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (theme && !form) setForm(theme);
  }, [theme, form]);

  if (!form) return <p>Loading branding settings...</p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      if (logoFile) {
        const data = new FormData();
        data.append("logo", logoFile);
        await api.post("/api/config/theme/logo", data);
      }
      await api.put("/api/config/theme", form);
      await refresh();
      setLogoFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Branding</h2>
      <p className="muted">Customize the colors, header text, font, and logo shown throughout the app.</p>

      <div className="grid cols-2">
        <div className="card">
          <h3>Settings</h3>
          <form onSubmit={save}>
            <div className="field">
              <label>League name</label>
              <input
                type="text"
                value={form.league_name}
                onChange={(e) => setForm({ ...form, league_name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Header text</label>
              <input
                type="text"
                value={form.header_text}
                onChange={(e) => setForm({ ...form, header_text: e.target.value })}
              />
            </div>

            <div className="row">
              <ColorField
                label="Primary color"
                value={form.primary_color}
                onChange={(v) => setForm({ ...form, primary_color: v })}
              />
              <ColorField
                label="Secondary color"
                value={form.secondary_color}
                onChange={(v) => setForm({ ...form, secondary_color: v })}
              />
            </div>
            <div className="row">
              <ColorField
                label="Accent color"
                value={form.accent_color}
                onChange={(v) => setForm({ ...form, accent_color: v })}
              />
              <ColorField
                label="Background color"
                value={form.background_color}
                onChange={(v) => setForm({ ...form, background_color: v })}
              />
              <ColorField
                label="Text color"
                value={form.text_color}
                onChange={(v) => setForm({ ...form, text_color: v })}
              />
            </div>

            <div className="field">
              <label>Font</label>
              <select value={form.font_family} onChange={(e) => setForm({ ...form, font_family: e.target.value })}>
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Logo image</label>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </div>

            {error && <div className="banner error">{error}</div>}

            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save branding"}
            </button>
            {saved && <span className="banner success" style={{ marginLeft: "1rem", display: "inline-block" }}>Saved</span>}
          </form>
        </div>

        <div className="card">
          <h3>Live preview</h3>
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: form.secondary_color,
                color: "#fff",
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontFamily: form.font_family,
              }}
            >
              {(logoFile || form.logo_url) && (
                <img
                  src={logoFile ? URL.createObjectURL(logoFile) : form.logo_url!}
                  alt="Logo preview"
                  style={{ height: 36, width: 36, objectFit: "contain", borderRadius: 6, background: "#fff" }}
                />
              )}
              <strong>{form.header_text}</strong>
            </div>
            <div style={{ background: form.primary_color, padding: "0.5rem 1rem" }}>
              <span style={{ color: "#fff", borderBottom: `3px solid ${form.accent_color}`, paddingBottom: 4, fontSize: "0.85rem" }}>
                Dashboard
              </span>
            </div>
            <div style={{ background: form.background_color, color: form.text_color, padding: "1rem", fontFamily: form.font_family }}>
              <p style={{ margin: 0 }}>This is how body text will look against your background color.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, padding: 2 }} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
