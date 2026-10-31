import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";

/** Visible breadcrumbs + BreadcrumbList structured data. The last item is the current page. */
export function Breadcrumbs({ items, className }: { items: { name: string; path: string }[]; className?: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          {items.map((it, i) => (
            <li key={it.path} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden className="text-border">
                  /
                </span>
              )}
              {i === items.length - 1 ? (
                <span aria-current="page" className="line-clamp-1 text-foreground">
                  {it.name}
                </span>
              ) : (
                <Link href={it.path} className="hover:text-foreground hover:underline">
                  {it.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(items)} />
    </>
  );
}
