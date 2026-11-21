"use client";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button, ButtonLink } from "@/components/ui/button";

/** Unexpected errors in a customer page: keeps the site header and footer, offers a retry. */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:py-28" role="alert">
      <h1 className="max-w-xl text-3xl font-bold text-balance sm:text-4xl">{t("site.error.title")}</h1>
      <p className="mt-4 max-w-md text-muted">{t("site.error.body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>{t("site.error.retry")}</Button>
        <ButtonLink href={`/${locale}`} variant="secondary">
          {t("site.error.home")}
        </ButtonLink>
      </div>
    </div>
  );
}
