export interface Team {
  id: number;
  name: string;
  division: string | null;
  notes: string | null;
}

export interface Coach {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  team_id: number | null;
  team_name: string | null;
}

export interface Player {
  id: number;
  name: string;
  team_id: number | null;
  team_name: string | null;
  jersey_number: string | null;
  position: string | null;
  birth_date: string | null;
}

export interface FieldAvailability {
  id: number;
  field_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Field {
  id: number;
  name: string;
  location: string | null;
  default_duration_minutes: number | null;
  notes: string | null;
  availability: FieldAvailability[];
}

export interface SeasonConfig {
  id: number;
  season_name: string | null;
  start_date: string | null;
  end_date: string | null;
  games_per_matchup: number;
  default_game_duration_minutes: number;
  break_between_games_minutes: number;
}

export interface ThemeConfig {
  id: number;
  league_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  header_text: string;
  font_family: string;
  logo_url: string | null;
}

export type EntityType = "teams" | "players" | "coaches";

export interface ImportResult {
  entityType: EntityType;
  inserted: number;
  updated: number;
  skipped: Array<{ row: number; reason: string }>;
}

export interface PreviewResult {
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface ScheduleBatch {
  id: number;
  created_at: string;
  season_name: string | null;
}

export interface Game {
  id: number;
  batch_id: number;
  round_number: number;
  date: string;
  start_time: string;
  end_time: string;
  field_id: number | null;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  home_team_name: string;
  away_team_name: string;
  field_name: string | null;
}

export interface BlackoutDate {
  id: number;
  date: string;
  reason: string | null;
}

export interface StandingsRow {
  team_id: number;
  team_name: string;
  division: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

export interface StandingsDivision {
  division: string;
  teams: StandingsRow[];
}

export interface GenerateScheduleResult {
  batchId: number;
  scheduledCount: number;
  unscheduled: Array<{
    round: number;
    division: string | null;
    home_team_id: number;
    away_team_id: number;
  }>;
}
