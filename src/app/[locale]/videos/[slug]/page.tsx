import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleSkeleton, ContentDetail, contentDetailMetadata } from "@/components/content/content-detail";

export async function generateMetadata({ params }: PageProps<"/[locale]/videos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return contentDetailMetadata("VIDEO", slug);
}

async function Video({ params }: { params: PageProps<"/[locale]/videos/[slug]">["params"] }) {
  const { slug } = await params;
  return <ContentDetail type="VIDEO" slug={slug} />;
}

export default function VideoPage({ params }: PageProps<"/[locale]/videos/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Video params={params} />
    </Suspense>
  );
}
