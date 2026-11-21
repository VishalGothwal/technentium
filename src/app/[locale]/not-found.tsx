import { getT } from "@/i18n/server";
import { ButtonLink } from "@/components/ui/button";

/** Branded 404 inside the site header and footer: unknown slugs (`notFound()`) and unmatched URLs (`[...missing]`). */
export default async function NotFound() {
  const { t, locale } = await getT();
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <p className="text-sm font-semibold tracking-widest text-muted uppercase">{t("site.notFound.eyebrow")}</p>
      <h1 className="mt-3 max-w-xl text-3xl font-bold text-balance sm:text-4xl">{t("site.notFound.title")}</h1>
      <p className="mt-4 max-w-md text-muted">{t("site.notFound.body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/${locale}`}>{t("site.notFound.home")}</ButtonLink>
        <ButtonLink href={`/${locale}/repairs`} variant="secondary">
          {t("site.notFound.repairs")}
        </ButtonLink>
        <ButtonLink href={`/${locale}/help`} variant="secondary">
          {t("site.notFound.help")}
        </ButtonLink>
      </div>
    </div>
  );
}
