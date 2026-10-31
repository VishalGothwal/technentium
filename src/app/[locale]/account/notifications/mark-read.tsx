"use client";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "../actions";

export function MarkAllReadButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" pending={pending} onClick={() => start(async () => void (await markNotificationsReadAction()))}>
      {t("account.markAllRead")}
    </Button>
  );
}
