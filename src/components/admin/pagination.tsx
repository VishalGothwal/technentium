import Link from "next/link";

/** Prev/next pagination preserving the other query params. */
export function Pagination({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {page} of {pages} · {total} total
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-lg border border-border bg-surface px-3.5 py-1.5 font-medium transition hover:border-foreground">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="rounded-lg border border-border bg-surface px-3.5 py-1.5 font-medium transition hover:border-foreground">
            Next
          </Link>
        )}
      </span>
    </nav>
  );
}

export const pageParam = (v: string | string[] | undefined) => Math.max(1, Number(Array.isArray(v) ? v[0] : v) || 1);
export const strParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
