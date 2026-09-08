interface Team {
  id: number;
  name: string;
  division: string | null;
}

interface FieldAvailability {
  field_id: number;
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
}

interface Field {
  id: number;
  default_duration_minutes: number | null;
  availability: FieldAvailability[];
}

interface SeasonConfig {
  start_date: string; // "YYYY-MM-DD"
  end_date: string;
  games_per_matchup: number;
  default_game_duration_minutes: number;
  break_between_games_minutes: number;
  game_days_of_week?: number[]; // 0 = Sunday ... 6 = Saturday; empty/undefined = no restriction
}

interface Slot {
  date: string;
  start_time: string;
  end_time: string;
  field_id: number;
  taken: boolean;
}

interface Matchup {
  round: number;
  division: string | null;
  homeTeamId: number;
  awayTeamId: number;
}

export interface ScheduledGame {
  round_number: number;
  date: string;
  start_time: string;
  end_time: string;
  field_id: number;
  home_team_id: number;
  away_team_id: number;
}

export interface ScheduleResult {
  scheduled: ScheduledGame[];
  unscheduled: Array<{ round: number; division: string | null; home_team_id: number; away_team_id: number }>;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildCandidateDates(season: SeasonConfig, explicitGameDays: string[]): string[] {
  if (explicitGameDays.length > 0) {
    return [...new Set(explicitGameDays)].sort();
  }

  const dates: string[] = [];
  const start = new Date(season.start_date + "T00:00:00");
  const end = new Date(season.end_date + "T00:00:00");
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000);
  const allowedWeekdays = season.game_days_of_week ?? [];

  for (let i = 0; i <= dayCount; i++) {
    const d = addDays(season.start_date, i);
    if (allowedWeekdays.length > 0 && !allowedWeekdays.includes(d.getDay())) continue;
    dates.push(formatDate(d));
  }
  return dates;
}

function buildSlotPool(
  fields: Field[],
  season: SeasonConfig,
  blackoutDates: Set<string>,
  explicitGameDays: string[]
): Slot[] {
  const slots: Slot[] = [];
  const candidateDates = buildCandidateDates(season, explicitGameDays);

  for (const dateStr of candidateDates) {
    if (blackoutDates.has(dateStr)) continue;
    const dow = new Date(dateStr + "T00:00:00").getDay();

    for (const field of fields) {
      const duration = field.default_duration_minutes ?? season.default_game_duration_minutes;
      const gap = season.break_between_games_minutes;
      for (const window of field.availability.filter((a) => a.day_of_week === dow)) {
        let cursor = timeToMinutes(window.start_time);
        const windowEnd = timeToMinutes(window.end_time);
        while (cursor + duration <= windowEnd) {
          slots.push({
            date: dateStr,
            start_time: minutesToTime(cursor),
            end_time: minutesToTime(cursor + duration),
            field_id: field.id,
            taken: false,
          });
          cursor += duration + gap;
        }
      }
    }
  }

  slots.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  return slots;
}

function roundRobinRounds(teamIds: number[]): number[][][] {
  const ids = [...teamIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push(-1); // -1 marks a bye

  const n = ids.length;
  const rounds: number[][][] = [];
  const arr = [...ids];

  for (let r = 0; r < n - 1; r++) {
    const pairs: number[][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== -1 && b !== -1) pairs.push([a, b]);
    }
    rounds.push(pairs);
    // rotate all but the first element
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return rounds;
}

function buildMatchupQueue(teams: Team[], gamesPerMatchup: number): Matchup[] {
  const byDivision = new Map<string | null, number[]>();
  for (const team of teams) {
    const key = team.division ?? null;
    if (!byDivision.has(key)) byDivision.set(key, []);
    byDivision.get(key)!.push(team.id);
  }

  const perDivisionRounds = new Map<string | null, number[][][]>();
  let maxRounds = 0;
  for (const [division, ids] of byDivision) {
    if (ids.length < 2) continue;
    const rounds = roundRobinRounds(ids);
    perDivisionRounds.set(division, rounds);
    maxRounds = Math.max(maxRounds, rounds.length);
  }

  const matchups: Matchup[] = [];
  let roundCounter = 0;

  for (let cycle = 0; cycle < gamesPerMatchup; cycle++) {
    for (let r = 0; r < maxRounds; r++) {
      roundCounter++;
      for (const [division, rounds] of perDivisionRounds) {
        const pairs = rounds[r];
        if (!pairs) continue;
        for (const [a, b] of pairs) {
          const swap = cycle % 2 === 1;
          matchups.push({
            round: roundCounter,
            division,
            homeTeamId: swap ? b : a,
            awayTeamId: swap ? a : b,
          });
        }
      }
    }
  }

  return matchups;
}

export function generateSchedule(
  teams: Team[],
  fields: Field[],
  season: SeasonConfig,
  blackoutDates: string[] = [],
  gameDays: string[] = []
): ScheduleResult {
  if (gameDays.length === 0 && (!season.start_date || !season.end_date)) {
    throw new Error("Season start_date and end_date must be configured, or specific game days added");
  }
  if (fields.length === 0) {
    throw new Error("At least one field with availability windows is required");
  }

  const slots = buildSlotPool(fields, season, new Set(blackoutDates), gameDays);
  const matchups = buildMatchupQueue(teams, season.games_per_matchup || 1);
  const teamBusyDates = new Map<number, Set<string>>();

  const scheduled: ScheduledGame[] = [];
  const unscheduled: ScheduleResult["unscheduled"] = [];

  const isBusy = (teamId: number, date: string) => teamBusyDates.get(teamId)?.has(date) ?? false;
  const markBusy = (teamId: number, date: string) => {
    if (!teamBusyDates.has(teamId)) teamBusyDates.set(teamId, new Set());
    teamBusyDates.get(teamId)!.add(date);
  };

  for (const matchup of matchups) {
    const slot = slots.find(
      (s) => !s.taken && !isBusy(matchup.homeTeamId, s.date) && !isBusy(matchup.awayTeamId, s.date)
    );

    if (!slot) {
      unscheduled.push({
        round: matchup.round,
        division: matchup.division,
        home_team_id: matchup.homeTeamId,
        away_team_id: matchup.awayTeamId,
      });
      continue;
    }

    slot.taken = true;
    markBusy(matchup.homeTeamId, slot.date);
    markBusy(matchup.awayTeamId, slot.date);

    scheduled.push({
      round_number: matchup.round,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      field_id: slot.field_id,
      home_team_id: matchup.homeTeamId,
      away_team_id: matchup.awayTeamId,
    });
  }

  scheduled.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));

  return { scheduled, unscheduled };
}
