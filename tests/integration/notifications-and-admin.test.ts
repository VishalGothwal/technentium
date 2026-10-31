import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import * as email from "@/server/providers/email";
import { dispatchDeliveries } from "@/server/notifications/dispatch";
import { submitBooking } from "@/server/modules/repairs/booking.service";
import { updateSettings } from "@/server/modules/settings/admin-settings.service";
import { setStaffActive, setStaffRoles } from "@/server/modules/team/team.service";
import { authorizeAttachment } from "@/server/modules/repairs/attachment.service";
import { bookingInput, key, newCustomer, owner, staff } from "../support/fixtures";

afterEach(() => vi.restoreAllMocks());

describe("notification delivery", () => {
  it("a provider failure is recorded and retried without undoing the booking or double-sending", async () => {
    const customer = await newCustomer();
    const { reference } = await submitBooking(customer, await bookingInput(), key());
    const event = await db.notificationEvent.findFirstOrThrow({ where: { recipientId: customer.userId }, include: { deliveries: true } });
    const emailDelivery = event.deliveries.find((d) => d.channel === "email")!;

    const send = vi.fn().mockRejectedValueOnce(new Error("SMTP down")).mockResolvedValue({ providerMessageId: "m-1" });
    vi.spyOn(email, "emailAdapter").mockReturnValue({ name: "mock", send });

    await dispatchDeliveries([emailDelivery.id]);
    let row = await db.notificationDelivery.findUniqueOrThrow({ where: { id: emailDelivery.id } });
    expect(row.status).toBe("FAILED");
    expect(row.lastError).toContain("SMTP down");
    expect(await db.repairBooking.count({ where: { reference } })).toBe(1);

    // Not due yet → sweep skips it.
    await dispatchDeliveries([emailDelivery.id]);
    expect(send).toHaveBeenCalledTimes(1);

    await db.notificationDelivery.update({ where: { id: emailDelivery.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    // Same code path the cron sweep uses once the backoff has elapsed.
    await dispatchDeliveries([emailDelivery.id]);
    row = await db.notificationDelivery.findUniqueOrThrow({ where: { id: emailDelivery.id } });
    expect(row.status).toBe("SENT");
    expect(row.attempts).toBe(2);

    // Already sent → never sent again.
    await dispatchDeliveries([emailDelivery.id]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("concurrent dispatchers claim each delivery once", async () => {
    const customer = await newCustomer();
    await submitBooking(customer, await bookingInput(), key());
    const event = await db.notificationEvent.findFirstOrThrow({ where: { recipientId: customer.userId }, include: { deliveries: true } });
    const ids = event.deliveries.map((d) => d.id);
    const send = vi.fn().mockResolvedValue({ providerMessageId: null });
    vi.spyOn(email, "emailAdapter").mockReturnValue({ name: "mock", send });

    await Promise.all([dispatchDeliveries(ids), dispatchDeliveries(ids)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await db.inAppNotification.count({ where: { eventId: event.id } })).toBe(1);
  });
});

describe("admin permissions", () => {
  it("staff cannot change settings; the owner can", async () => {
    await expect(updateSettings(await staff(), { "quote.expiryDays": 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateSettings(await owner(), { "quote.expiryDays": 7 });
    await expect(updateSettings(await owner(), { "quote.expiryDays": 0 })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("staff cannot manage the team or escalate their own role", async () => {
    const s = await staff();
    await expect(setStaffRoles(s, s.userId, ["owner"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("the last owner cannot be demoted or deactivated", async () => {
    const o = await owner();
    await expect(setStaffRoles(o, o.userId, ["staff"])).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(setStaffActive(o, o.userId, false)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("customers cannot fetch another customer's photo", async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    const att = await db.repairAttachment.create({
      data: { storageKey: `test/${key()}.webp`, mime: "image/webp", sizeBytes: 1, purpose: "BOOKING_PHOTO", uploadedById: a.userId },
    });
    await expect(authorizeAttachment(a, att.id)).resolves.toBeTruthy();
    await expect(authorizeAttachment(b, att.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(authorizeAttachment(await staff(), att.id)).resolves.toBeTruthy();
  });
});
