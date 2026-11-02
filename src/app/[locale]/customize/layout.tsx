import { SectionGate } from "@/components/site/platform";

/** The customization studio can be switched off in Admin → Feature controls. */
export default function Layout({ children }: LayoutProps<"/[locale]/customize">) {
  return <SectionGate section="customization">{children}</SectionGate>;
}
