import { SectionGate } from "@/components/site/platform";

/** Specifications can be switched off in Admin → Feature controls. */
export default function Layout({ children }: LayoutProps<"/[locale]/specs">) {
  return <SectionGate section="content">{children}</SectionGate>;
}
