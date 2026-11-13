import Link from "next/link";
import { Suspense } from "react";
import { Clock, MapPin, MessageCircle, Phone, User } from "lucide-react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { getSession } from "@/server/auth/session";
import { cachedHeaderNav } from "@/server/modules/catalog/nav.cached";
import { ButtonLink } from "@/components/ui/button";
import { CartLink } from "@/components/shop/cart-link";
import { DesktopNav, MobileMenu, type NavEntry } from "./header-menus";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { deviceIcon, HEADER_ICON_BUTTON, productIcon } from "./nav-icons";
import { SignOutButton } from "./sign-out-button";
import { SiteSearch } from "./site-search";

/**
 * Desktop: a black utility strip (area, hours, phone, language) above a sticky bar with mega menus fed by
 * the live catalogue. Below `lg` the bar shrinks to logo · cart · menu and everything moves into a sheet.
 */
export async function SiteHeader() {
  const { t, locale } = await getT();
  const nav = await cachedHeaderNav();
  const l = (path: string) => `/${locale}${path}`;
  const tel = nav.supportPhone ? `tel:${nav.supportPhone.replace(/\s/g, "")}` : null;
  const wa = nav.whatsapp ? `https://wa.me/${nav.whatsapp}?text=${encodeURIComponent(t("site.header.waMessage"))}` : null;

  const entries: NavEntry[] = [
    {
      key: "repairs",
      href: l("/repairs"),
      label: t("nav.repairs"),
      icon: "repair",
      mega: {
        title: t("site.header.repairsTitle"),
        body: t("site.header.repairsBody"),
        all: { href: l("/repairs"), label: t("site.header.allRepairs") },
        columns: nav.repairs.map((c) => ({
          href: l(`/repairs/${c.slug}`),
          label: localized(locale, c.nameEn, c.nameHi),
          icon: deviceIcon(c.slug),
          meta: t("site.header.brands", { count: c.brands.length }),
          links: c.brands.slice(0, 5).map((b) => ({
            href: l(`/repairs/${c.slug}/${b.slug}`),
            label: b.name,
          })),
        })),
        feature: {
          title: t("nav.bookRepair"),
          body: t("site.header.bookBody"),
          points: [t("repairFlow.point1"), t("repairFlow.point2"), t("repairFlow.point3")],
          href: l("/repairs/book"),
          cta: t("nav.bookRepair"),
        },
      },
    },
    {
      key: "protection",
      href: l("/protection"),
      label: t("nav.protection"),
      icon: "shield",
      mega: {
        title: t("site.header.protectionTitle"),
        all: {
          href: l("/protection/products"),
          label: t("site.header.allProducts"),
        },
        columns: nav.products.map((c) => ({
          href: l(`/protection/products?category=${c.slug}`),
          label: localized(locale, c.nameEn, c.nameHi),
          icon: productIcon(c.slug),
          meta: t("site.header.products", { count: c.count }),
          links: c.types.slice(0, 5).map((x) => ({ href: l(`/protection/products?category=${c.slug}&type=${x.slug}`), label: localized(locale, x.nameEn, x.nameHi) })),
        })),
        feature: {
          title: t("nav.customization"),
          body: t("site.header.customizeBody"),
          href: l("/customize"),
          cta: t("site.header.explore"),
        },
      },
    },
    {
      key: "customize",
      href: l("/customize"),
      label: t("nav.customization"),
      icon: "palette",
      description: t("site.header.customizeBody"),
    },
    {
      key: "specs",
      href: l("/specs"),
      label: t("nav.specs"),
      icon: "specs",
      description: t("site.header.specsBody"),
    },
    {
      key: "articles",
      href: l("/articles"),
      label: t("nav.articles"),
      icon: "articles",
      description: t("site.header.articlesBody"),
    },
    {
      key: "help",
      href: l("/help"),
      label: t("nav.help"),
      icon: "help",
      description: t("site.header.helpBody"),
    },
  ];

  return (
    <>
      {/* Utility strip: scrolls away; only the main bar is sticky. */}
      <div className="hidden bg-black text-xs tracking-wide text-white/70 lg:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center gap-6 px-4 lg:px-6">
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden className="size-3.5" />
            {t("site.header.area")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5" />
            {t("site.header.hours")}
          </span>
          <div className="ml-auto flex items-center gap-5">
            <Link href={l("/track")} className="transition hover:text-white">
              {t("site.footer.track")}
            </Link>
            {tel && (
              <a href={tel} className="inline-flex items-center gap-1.5 font-semibold text-white transition hover:text-white/80">
                <Phone aria-hidden className="size-3.5" />
                {nav.supportPhone}
              </a>
            )}
            <LanguageSwitcher tone="inverse" />
          </div>
        </div>
      </div>

      {/* Frosted glass bar with a hairline edge and a soft shadow, so it floats over the page. */}
      <header className="sticky top-0 z-40 border-b border-black/6 bg-surface/90 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-16px_rgba(0,0,0,0.18)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-surface/75">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:h-16 lg:gap-4 lg:px-6">
          <Link href={l("")} className="shrink-0 rounded-md" aria-label={t("common.brand")}>
            <Logo />
          </Link>

          <DesktopNav entries={entries} />

          <div className="ml-auto flex items-center justify-end gap-1 sm:gap-1.5 xl:min-w-0 xl:flex-1">
            <SiteSearch
              locale={locale}
              labels={{
                open: t("site.search.open"),
                close: t("site.search.close"),
                placeholder: t("site.search.placeholder"),
                empty: t("site.search.empty"),
                hint: t("site.search.hint"),
                devices: t("site.search.devices"),
                specs: t("site.search.specs"),
                products: t("site.search.products"),
                articles: t("site.search.articles"),
              }}
            />
            {(tel || wa) && (
              // Book by phone or WhatsApp: one compact pill, same height as the search and the bubble.
              <div className="flex h-9 shrink-0 items-center rounded-full border border-border/80 bg-surface-muted/80 p-0.5">
                {tel && (
                  <a
                    href={tel}
                    aria-label={t("site.header.callToBook")}
                    title={t("site.header.callToBook")}
                    className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-foreground transition hover:bg-surface hover:shadow-sm"
                  >
                    <Phone aria-hidden className="size-4" strokeWidth={2} />
                    <span className="hidden 2xl:inline">{t("site.header.callShort")}</span>
                  </a>
                )}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("site.header.chatToBook")}
                    title={t("site.header.chatToBook")}
                    className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-[#128c4a] transition hover:bg-surface hover:shadow-sm"
                  >
                    <MessageCircle aria-hidden className="size-4" strokeWidth={2} />
                    <span className="hidden 2xl:inline">{t("site.header.chatShort")}</span>
                  </a>
                )}
              </div>
            )}
            <Suspense fallback={<span className="size-10" />}>
              <AccountButton locale={locale} />
            </Suspense>
            <Suspense fallback={<span className="size-10" />}>
              <CartLink />
            </Suspense>
            <ButtonLink
              href={l("/repairs/book")}
              size="sm"
              className="ml-1.5 hidden h-9 rounded-full px-4 font-semibold shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)] transition hover:-translate-y-px hover:shadow-[0_10px_22px_-8px_rgba(0,0,0,0.5)] sm:inline-flex"
            >
              {t("nav.bookRepair")}
            </ButtonLink>
            <MobileMenu
              entries={entries}
              logo={<Logo />}
              labels={{
                open: t("nav.openMenu"),
                close: t("nav.closeMenu"),
                menu: t("site.header.menu"),
                needHelp: t("site.header.needHelp"),
              }}
              book={{
                href: l("/repairs/book"),
                label: t("nav.bookRepair"),
                body: t("site.header.bookBody"),
              }}
              track={{
                href: l("/track"),
                label: t("site.footer.track"),
                description: t("site.header.trackBody"),
              }}
              contact={{
                tel,
                phone: nav.supportPhone ? t("site.header.call", { phone: nav.supportPhone }) : null,
                hours: t("site.header.hours"),
                area: t("site.header.area"),
              }}
              account={
                <Suspense fallback={null}>
                  <MobileAccount locale={locale} />
                </Suspense>
              }
              language={<LanguageSwitcher />}
            />
          </div>
        </div>
      </header>
    </>
  );
}

async function AccountButton({ locale }: { locale: string }) {
  const { t } = await getT();
  const session = await getSession();
  const href = session ? `/${locale}/account` : `/${locale}/auth/sign-in`;
  const label = session ? t("common.myAccount") : t("common.signIn");
  return (
    <Link href={href} aria-label={label} title={label} className={`${HEADER_ICON_BUTTON} hidden lg:flex`}>
      <User aria-hidden className="size-5" strokeWidth={1.75} />
      {session && <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-success ring-2 ring-surface" />}
    </Link>
  );
}

async function MobileAccount({ locale }: { locale: string }) {
  const { t } = await getT();
  const session = await getSession();
  if (!session) {
    return (
      <ButtonLink href={`/${locale}/auth/sign-in`} variant="secondary" block className="rounded-xl">
        <User aria-hidden className="size-4" />
        {t("common.signIn")}
      </ButtonLink>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-white">
        {(session.user.name || session.user.email || "?").slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/${locale}/account`} className="block truncate font-semibold hover:underline">
          {session.user.name || t("common.myAccount")}
        </Link>
        <p className="text-xs text-muted">{t("site.header.signedIn")}</p>
      </div>
      <SignOutButton label={t("common.signOut")} className="shrink-0" />
    </div>
  );
}
