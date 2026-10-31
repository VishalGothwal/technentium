import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/server/auth/session";
import { cachedDesignOptions, cachedDesigns } from "@/server/modules/customization/catalog.cached";
import { Skeleton } from "@/components/ui/surface";
import { StudioTheme } from "@/components/customization/studio-theme";
import { Studio } from "./studio";

// Reads the session and ?design=; the studio itself is interactive.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/customize/studio", title: t("studio.title"), description: t("studio.meta.description") });
}

async function StudioWithData({ searchParams }: { searchParams: PageProps<"/[locale]/customize/studio">["searchParams"] }) {
  const [sp, session, designs, options] = await Promise.all([searchParams, getSession(), cachedDesigns(), cachedDesignOptions()]);
  const slug = typeof sp.design === "string" ? sp.design.slice(0, 80) : null;
  return (
    <Studio
      key={slug ?? "blank"}
      designs={designs.map(({ id, slug, nameEn, nameHi, collection, style, basePricePaise }) => ({ id, slug, nameEn, nameHi, collection, style, basePricePaise }))}
      finishes={options.finishes}
      coverages={options.coverages}
      initialDesignSlug={slug}
      initialSignedIn={!!session}
    />
  );
}

export default async function StudioPage({ searchParams }: PageProps<"/[locale]/customize/studio">) {
  const { t } = await getT();
  return (
    <StudioTheme className="min-h-[calc(100vh-4rem)]">
      <h1 className="sr-only">{t("studio.title")}</h1>
      <Suspense fallback={<Skeleton className="mx-auto my-8 h-[70vh] max-w-6xl rounded-3xl" />}>
        <StudioWithData searchParams={searchParams} />
      </Suspense>
    </StudioTheme>
  );
}
