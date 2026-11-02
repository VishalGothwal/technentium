import { SectionGate } from "@/components/site/platform";

/** Articles can be switched off in Admin → Feature controls. */
export default function Layout({ children }: LayoutProps<"/[locale]/articles">) {
  return <SectionGate section="content">{children}</SectionGate>;
}
