import { SectionGate } from "@/components/site/platform";

/** Repair booking can be switched off in Admin → Feature controls. */
export default function Layout({ children }: LayoutProps<"/[locale]/repairs/book">) {
  return <SectionGate section="repairs">{children}</SectionGate>;
}
