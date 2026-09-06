import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { ThemeConfig } from "../types";

interface ThemeContextValue {
  theme: ThemeConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeVariables(theme: ThemeConfig) {
  const root = document.documentElement.style;
  root.setProperty("--color-primary", theme.primary_color);
  root.setProperty("--color-secondary", theme.secondary_color);
  root.setProperty("--color-accent", theme.accent_color);
  root.setProperty("--color-background", theme.background_color);
  root.setProperty("--color-text", theme.text_color);
  root.setProperty("--font-family", theme.font_family);
  document.title = theme.league_name || "FutbolScheduler";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await api.get<ThemeConfig>("/api/config/theme");
    setTheme(data);
    applyThemeVariables(data);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return <ThemeContext.Provider value={{ theme, loading, refresh }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
