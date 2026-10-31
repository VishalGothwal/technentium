"use client";
import { useEffect, useState } from "react";
import type { RelationTarget } from "@/lib/schemas/content";
import { searchRelationsAction } from "@/app/admin/(console)/content/actions";

export type RelationOption = { targetType: RelationTarget; targetId: string; label: string; hint: string };

/** Search articles, products, repair services, specs and comparisons, and keep an ordered selection. */
export function RelationPicker({ value, onChange, max = 20, excludeId }: { value: RelationOption[]; onChange: (v: RelationOption[]) => void; max?: number; excludeId?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RelationOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const handle = setTimeout(async () => {
      setLoading(true);
      const res = await searchRelationsAction(q);
      if (!alive) return;
      setLoading(false);
      setResults(res.ok ? res.data : []);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [q, open]);

  const has = (o: RelationOption) => value.some((v) => v.targetType === o.targetType && v.targetId === o.targetId);
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ol className="space-y-1">
          {value.map((v, i) => (
            <li key={`${v.targetType}:${v.targetId}`} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{v.label}</span>
                <span className="text-xs text-muted">{v.hint}</span>
              </span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1.5 text-muted hover:bg-surface-muted disabled:opacity-30" aria-label={`Move ${v.label} up`}>
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="rounded px-1.5 text-muted hover:bg-surface-muted disabled:opacity-30" aria-label={`Move ${v.label} down`}>
                ↓
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded px-1.5 text-danger hover:bg-danger-soft" aria-label={`Remove ${v.label}`}>
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
      {value.length < max && (
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search articles, products, repairs, specs…"
            aria-label="Search content to link"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          />
          {open && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lg" role="listbox">
              {loading && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
              {!loading && results.filter((r) => !(r.targetType === "CONTENT" && r.targetId === excludeId)).length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
              {!loading &&
                results
                  .filter((r) => !(r.targetType === "CONTENT" && r.targetId === excludeId))
                  .map((r) => (
                    <li key={`${r.targetType}:${r.targetId}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={has(r)}
                        disabled={has(r)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onChange([...value, r])}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
                      >
                        <span className="truncate">{r.label}</span>
                        <span className="shrink-0 text-xs text-muted">{has(r) ? "Added" : r.hint}</span>
                      </button>
                    </li>
                  ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
