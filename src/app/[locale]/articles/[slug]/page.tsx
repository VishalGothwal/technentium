import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleSkeleton, ContentDetail, contentDetailMetadata } from "@/components/content/content-detail";

export async function generateMetadata({ params }: PageProps<"/[locale]/articles/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return contentDetailMetadata("ARTICLE", slug);
}

async function Article({ params }: { params: PageProps<"/[locale]/articles/[slug]">["params"] }) {
  const { slug } = await params;
  return <ContentDetail type="ARTICLE" slug={slug} />;
}

export default function ArticlePage({ params }: PageProps<"/[locale]/articles/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Article params={params} />
    </Suspense>
  );
}
