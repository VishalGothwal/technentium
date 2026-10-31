import Link from "next/link";
import { getT } from "@/i18n/server";
import { getRelatedGuides } from "@/server/modules/content/content.public";
import { ArticleCard } from "./article-card";

/**
 * "From our guides" — drop-in interlinking block for any customer page (product, repair, studio…).
 * Server component; must be rendered inside the `[locale]` tree. Renders nothing when no guides match.
 *
 *   <RelatedGuides topic="protection" tags={["screen-protector"]} />
 */
export async function RelatedGuides({ topic, tags, limit = 3, title, className }: { topic?: string; tags?: string[]; limit?: number; title?: string; className?: string }) {
  const { t, locale } = await getT();
  const cards = await getRelatedGuides(locale, { topic, tags, limit });
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="related-guides-title" className={className}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="related-guides-title" className="text-xl font-bold tracking-tight">
          {title ?? t("articles.fromGuides")}
        </h2>
        <Link href={`/${locale}/articles${topic ? `/topic/${topic}` : ""}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
          {t("articles.viewAll")} →
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.id}>
            <ArticleCard card={c} locale={locale} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
