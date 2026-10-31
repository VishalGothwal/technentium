import Link from "next/link";
import { getT } from "@/i18n/server";
import { CookieSettingsButton } from "./analytics";
import { Logo } from "./logo";

export async function SiteFooter() {
  const { t, locale } = await getT();
  const l = (path: string) => `/${locale}${path}`;
  const columns: { title: string; links: [string, string][] }[] = [
    {
      title: t("site.footer.services"),
      links: [
        [l("/repairs"), t("nav.repairs")],
        [l("/repairs/book"), t("site.footer.bookRepair")],
        [l("/track"), t("site.footer.track")],
        [l("/guide"), t("site.footer.guide")],
      ],
    },
    {
      title: t("site.footer.shop"),
      links: [
        [l("/protection"), t("site.footer.protection")],
        [l("/customize"), t("site.footer.customize")],
      ],
    },
    {
      title: t("site.footer.learn"),
      links: [
        [l("/articles"), t("site.footer.articles")],
        [l("/videos"), t("site.footer.videos")],
        [l("/specs"), t("site.footer.specs")],
        [l("/compare"), t("site.footer.compare")],
      ],
    },
    {
      title: t("site.footer.support"),
      links: [
        [l("/help"), t("site.footer.help")],
        [l("/policies/privacy"), t("footer.privacy")],
        [l("/policies/terms"), t("footer.terms")],
        [l("/policies/repair"), t("footer.repairPolicy")],
        [l("/developers"), t("site.footer.developers")],
      ],
    },
  ];

  return (
    <footer className="mt-16 bg-black text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <Logo tone="inverse" className="text-white" />
          <p className="max-w-xs text-sm leading-relaxed text-neutral-400">{t("footer.tagline")}</p>
          <p className="text-sm text-neutral-400">{t("site.footer.repairsIn")}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-neutral-300 transition hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-neutral-400 sm:flex-row">
          <p>{t("footer.rights", { year: 2026 })}</p>
          <CookieSettingsButton label={t("site.footer.cookies")} />
        </div>
      </div>
    </footer>
  );
}
