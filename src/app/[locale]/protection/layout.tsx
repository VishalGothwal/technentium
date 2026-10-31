import { getT } from "@/i18n/server";

/** Store-wide announcement strip above every protection page. */
export default async function ProtectionLayout({ children }: LayoutProps<"/[locale]/protection">) {
  const { t } = await getT();
  return (
    <>
      <p className="border-b border-border bg-surface-muted px-4 py-2 text-center text-[0.7rem] font-medium tracking-wide text-foreground sm:text-xs">{t("shop.announcement")}</p>
      {children}
    </>
  );
}
