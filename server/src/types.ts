export type EntityType = "teams" | "players" | "coaches";

export interface ParsedRow {
  [column: string]: string;
}

export interface ImportResult {
  entityType: EntityType;
  inserted: number;
  updated: number;
  skipped: Array<{ row: number; reason: string }>;
}
