import type { Metadata } from "next";
import { ContentDetail, contentDetailMetadata } from "@/components/content/content-detail";

export async function generateMetadata({ params }: PageProps<"/[locale]/videos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return contentDetailMetadata("VIDEO", slug);
}

// Resolved outside Suspense (blocking route) so an unknown slug returns a real 404 for search engines.
export const instant = false;

export default async function VideoPage({ params }: PageProps<"/[locale]/videos/[slug]">) {
  const { slug } = await params;
  return <ContentDetail type="VIDEO" slug={slug} />;
}
