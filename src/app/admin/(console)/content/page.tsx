import Link from "next/link";
import type { ContentStatus, ContentType } from "@/generated/prisma/client";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listContentAdmin } from "@/server/modules/content/content.admin";
import { formatDate, formatDateTime } from "@/lib/format";
import { CONTENT_TOPICS } from "@/lib/schemas/content";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { Pagination, pageParam, strParam } from "@/components/admin/pagination";

export const metadata = { title: "Articles & videos" };
export const instant = false;

const STATUS_TONE = { DRAFT: "neutral", SCHEDULED: "info", PUBLISHED: "success", ARCHIVED: "warning" } as const;
const TYPES = ["ARTICLE", "VIDEO"] as const;
const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
const pick = <T extends string>(v: string | undefined, list: readonly T[]) => (v && (list as readonly string[]).includes(v) ? (v as T) : undefined);

export default async function ContentListPage({ searchParams }: PageProps<"/admin/content">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const sp = await searchParams;
  const filters = {
    type: pick<ContentType>(strParam(sp.type), TYPES),
    status: pick<ContentStatus>(strParam(sp.status), STATUSES),
    locale: pick(strParam(sp.locale), ["en", "hi"] as const),
    topic: pick(strParam(sp.topic), CONTENT_TOPICS),
    q: strParam(sp.q)?.slice(0, 100),
    page: pageParam(sp.page),
  };
  const { items, total, page, pageSize } = await listContentAdmin(actor, filters);
  const selectCls = "h-10 rounded-lg border border-border bg-surface px-2 text-sm";

  return (
    <>
      <PageHeader
        title="Articles & videos"
        description="Bilingual content. Each language is published on its own; drafts are never public."
        actions={
          <>
            <ButtonLink href="/admin/content/new?type=VIDEO" variant="secondary">
              New video
            </ButtonLink>
            <ButtonLink href="/admin/content/new">New article</ButtonLink>
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={filters.q} placeholder="Search title or slug" aria-label="Search content" className="h-10 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-sm" />
        <select name="type" defaultValue={filters.type ?? ""} aria-label="Type" className={selectCls}>
          <option value="">All types</option>
          <option value="ARTICLE">Articles</option>
          <option value="VIDEO">Videos</option>
        </select>
        <select name="status" defaultValue={filters.status ?? ""} aria-label="Status" className={selectCls}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
        <select name="locale" defaultValue={filters.locale ?? ""} aria-label="Language" className={selectCls}>
          <option value="">Any language</option>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </select>
        <select name="topic" defaultValue={filters.topic ?? ""} aria-label="Topic" className={selectCls}>
          <option value="">All topics</option>
          {CONTENT_TOPICS.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Filter
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No content matches" description="Try other filters, or create a new article." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const en = it.translations.find((t) => t.locale === "en");
              const title = (en ?? it.translations[0])?.title ?? it.slug;
              return (
                <li key={it.id}>
                  <Link href={`/admin/content/${it.id}`} className="flex flex-col gap-2 p-4 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs text-muted">
                        <span className="font-semibold">{it.type === "VIDEO" ? "Video" : "Article"}</span>· {it.topic}
                        {it.featured && <Badge tone="primary">featured</Badge>}
                      </p>
                      <p className="truncate font-medium">{title}</p>
                      <p className="truncate font-mono text-xs text-muted">/{it.slug}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                      {(["en", "hi"] as const).map((l) => {
                        const t = it.translations.find((x) => x.locale === l);
                        return (
                          <span key={l} className="flex items-center gap-1">
                            <span className="font-semibold uppercase">{l}</span>
                            {t ? (
                              <Badge tone={STATUS_TONE[t.status]} title={t.status === "SCHEDULED" && t.scheduledAt ? `Goes live ${formatDateTime(t.scheduledAt)}` : undefined}>
                                {t.status.toLowerCase()}
                              </Badge>
                            ) : (
                              <Badge>—</Badge>
                            )}
                          </span>
                        );
                      })}
                      <span className="text-muted">Updated {formatDate(it.updatedAt)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/content" params={{ q: filters.q, type: filters.type, status: filters.status, locale: filters.locale, topic: filters.topic }} />
    </>
  );
}
