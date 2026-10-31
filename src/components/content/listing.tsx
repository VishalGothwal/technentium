import Link from "next/link";
import { getT } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { CONTENT_TOPICS, listContentQuerySchema } from "@/lib/schemas/content";
import { getContentList, getFeatured, getTopicCounts } from "@/server/modules/content/content.public";
import { ArticleCard } from "./article-card";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Topic chips + search box (static: renders in the prerendered shell). */
export async function ListingFilters({ basePath, type, activeTopic }: { basePath: string; type: "ARTICLE" | "VIDEO"; activeTopic?: string }) {
  const { t, locale } = await getT();
  const counts = await getTopicCounts(type);
  const root = `/${locale}/${type === "VIDEO" ? "videos" : "articles"}`;
  const topics = CONTENT_TOPICS.filter((tp) => counts[tp]);
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {type === "ARTICLE" && topics.length > 0 && (
        <nav aria-label={t("articles.allTopics")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-2">
            <li>
              <Chip href={root} active={!activeTopic}>
                {t("articles.allTopics")}
              </Chip>
            </li>
            {topics.map((tp) => (
              <li key={tp}>
                <Chip href={`${root}/topic/${tp}`} active={activeTopic === tp}>
                  {t(`articles.topics.${tp}`)}
                  <span className="ml-1.5 text-xs opacity-70">{counts[tp]}</span>
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <form action={basePath} role="search" className="relative w-full md:max-w-xs">
        <label htmlFor="content-search" className="sr-only">
          {t("articles.searchLabel")}
        </label>
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input id="content-search" name="q" type="search" placeholder={t("articles.searchPlaceholder")} className="h-11 w-full rounded-full border border-border bg-surface pr-4 pl-9 text-base sm:text-sm" />
      </form>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:border-foreground/40",
      )}
    >
      {children}
    </Link>
  );
}

/** Results grid (reads searchParams — render inside <Suspense>). Featured hero only on the unfiltered first page. */
export async function ListingResults({ searchParams, type, topic, basePath, showHero = true }: { searchParams: Promise<SP>; type: "ARTICLE" | "VIDEO"; topic?: string; basePath: string; showHero?: boolean }) {
  const { t, locale } = await getT();
  const sp = await searchParams;
  const parsed = listContentQuerySchema.safeParse({ type, topic, q: first(sp.q) || undefined, tag: first(sp.tag) || undefined, page: first(sp.page) ?? 1, pageSize: 12 });
  const query = parsed.success ? parsed.data : listContentQuerySchema.parse({ type, topic });
  const filtered = !!(query.q || query.tag);
  const hero = showHero && !filtered && query.page === 1 ? await getFeatured(locale, type) : null;
  const list = await getContentList(locale, query);
  const items = hero ? list.items.filter((c) => c.id !== hero.id) : list.items;
  const pages = Math.max(1, Math.ceil(list.total / query.pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (query.q) q.set("q", query.q);
    if (query.tag) q.set("tag", query.tag);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="space-y-8">
      {filtered && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-semibold">{query.q ? t("articles.resultsFor", { q: query.q }) : `#${query.tag}`}</p>
          <Link href={basePath} className="text-sm font-medium text-primary hover:underline">
            {t("articles.clearFilters")}
          </Link>
        </div>
      )}
      {hero && <ArticleCard card={hero} locale={locale} t={t} variant="hero" />}
      {items.length === 0 && !hero ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-lg font-semibold">{type === "VIDEO" ? t("videos.noResults") : t("articles.noResults")}</p>
          <p className="mt-1 text-muted">{t("articles.noResultsBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <ArticleCard card={c} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label={t("articles.pageOf", { page: query.page, pages })} className="flex items-center justify-between border-t border-border pt-6 text-sm">
          {query.page > 1 ? (
            <Link href={href(query.page - 1)} rel="prev" className="rounded-full border border-border px-4 py-2 font-medium hover:bg-surface-muted">
              ← {t("articles.previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">{t("articles.pageOf", { page: query.page, pages })}</span>
          {query.page < pages ? (
            <Link href={href(query.page + 1)} rel="next" className="rounded-full border border-border px-4 py-2 font-medium hover:bg-surface-muted">
              {t("articles.next")} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="aspect-[16/9] animate-pulse bg-surface-muted" />
          <div className="space-y-2 p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-surface-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
