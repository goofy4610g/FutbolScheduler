interface IcsGame {
  uid: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  summary: string;
  location: string | null;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toIcsDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

export function buildIcsCalendar(calendarName: string, games: IcsGame[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FutbolScheduler//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  for (const game of games) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${game.uid}@futbolscheduler`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsDateTime(game.date, game.start_time)}`,
      `DTEND:${toIcsDateTime(game.date, game.end_time)}`,
      `SUMMARY:${escapeText(game.summary)}`,
      ...(game.location ? [`LOCATION:${escapeText(game.location)}`] : []),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
