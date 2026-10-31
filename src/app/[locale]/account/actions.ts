"use server";
import { z } from "zod";
import { db } from "@/server/db";
import { runAction } from "@/server/actions";
import { AppError } from "@/server/errors";
import { parse } from "@/server/validation";
import { OPTIONAL_CHANNELS } from "@/server/notifications/matrix";
import { cancelMyBooking, respondToInfoRequest } from "@/server/modules/repairs/booking.service";
import { decideQuote } from "@/server/modules/quotes/quote.service";
import { LOCALES } from "@/i18n/config";

export async function decideQuoteAction(versionId: string, input: unknown) {
  return runAction((actor) => decideQuote(actor, versionId, input));
}

export async function cancelBookingAction(reference: string) {
  return runAction((actor) => cancelMyBooking(actor, reference));
}

export async function replyToInfoRequestAction(reference: string, message: string) {
  return runAction((actor) => respondToInfoRequest(actor, reference, message));
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "validation.name").max(80),
  preferredLocale: z.enum(LOCALES),
});

export async function updateProfileAction(input: unknown) {
  return runAction(async (actor) => {
    if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
    const data = parse(profileSchema, input);
    await db.user.update({ where: { id: actor.userId }, data });
  });
}

export async function setChannelPreferenceAction(channel: string, enabled: boolean) {
  return runAction(async (actor) => {
    if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
    if (!(OPTIONAL_CHANNELS as readonly string[]).includes(channel)) throw new AppError("VALIDATION", "validation.invalid");
    await db.notificationPreference.upsert({
      where: { userId_channel: { userId: actor.userId, channel } },
      create: { userId: actor.userId, channel, enabled },
      update: { enabled },
    });
  });
}

export async function markNotificationsReadAction() {
  return runAction(async (actor) => {
    if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
    await db.inAppNotification.updateMany({ where: { userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
  });
}
