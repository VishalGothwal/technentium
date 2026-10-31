/**
 * Minimal RFC 4180 CSV reader: comma-separated, `"` quoting with `""` escapes, CRLF or LF line ends.
 * Returns rows of trimmed cells; blank lines are dropped. Enough for staff-prepared catalogue imports.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") endCell();
    else if (ch === "\n") endRow();
    else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}
