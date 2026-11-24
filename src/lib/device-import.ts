/**
 * "Paste list" bulk add: one device per line as `Brand, Model[, Year]` (tab-separated also works, e.g. pasted
 * from a spreadsheet) → the CSV the model importer expects (category,brand,model,releaseYear,frame,popular,aliases).
 */
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function pasteListToCsv(categorySlug: string, text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = (l.includes("\t") ? l.split("\t") : l.split(",")).map((p) => p.trim());
      const year = parts.length > 2 && /^\d{4}$/.test(parts[parts.length - 1]) ? parts.pop()! : "";
      const [brand = "", ...model] = parts;
      return [categorySlug, brand, model.join(", "), year, "", "", ""].map(cell).join(",");
    });
  return ["category,brand,model,releaseYear,frame,popular,aliases", ...rows].join("\n");
}
