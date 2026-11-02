import { SectionGate } from "@/components/site/platform";

/** Comparisons can be switched off in Admin → Feature controls. */
export default function Layout({ children }: LayoutProps<"/[locale]/compare">) {
  return <SectionGate section="content">{children}</SectionGate>;
}
