import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { ParsedRow } from "../types.js";

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_]+/g, "_");
}

function normalizeRows(rows: Record<string, unknown>[]): ParsedRow[] {
  return rows.map((row) => {
    const normalized: ParsedRow = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value == null ? "" : String(value).trim();
    }
    return normalized;
  });
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String((value as { result: unknown }).result ?? "");
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}

async function parseXlsx(buffer: Buffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's published types lag behind @types/node's generic Buffer signature.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cellText(cell.value));
  });

  const rows: Record<string, unknown>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const text = cellText(cell.value);
      if (text) hasValue = true;
      record[header] = text;
    });
    if (hasValue) rows.push(record);
  }
  return normalizeRows(rows);
}

export async function parseSpreadsheetFile(buffer: Buffer, filename: string): Promise<ParsedRow[]> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    const delimiter = lower.endsWith(".tsv") ? "\t" : undefined;
    const text = buffer.toString("utf-8");
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter,
    });
    if (result.errors.length > 0) {
      const fatal = result.errors.find((e) => e.type !== "FieldMismatch");
      if (fatal) throw new Error(`CSV parse error: ${fatal.message}`);
    }
    return normalizeRows(result.data);
  }

  if (lower.endsWith(".xlsx")) {
    return parseXlsx(buffer);
  }

  throw new Error(
    `Unsupported file type for "${filename}". Please upload a .csv, .tsv, or .xlsx file.`
  );
}
