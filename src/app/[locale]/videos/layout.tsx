import { SectionGate } from "@/components/site/platform";

/** Videos can be switched off in Admin → Feature controls. */
export default function Layout({ children }: LayoutProps<"/[locale]/videos">) {
  return <SectionGate section="content">{children}</SectionGate>;
}
