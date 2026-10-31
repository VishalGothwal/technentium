import { describe, expect, it } from "vitest";
import type { Actor } from "@/server/rbac/actor";
import { db } from "@/server/db";
import { confirmBooking, getMyBooking, submitBooking } from "@/server/modules/repairs/booking.service";
import { recordDiagnosis, recordInspection, recordQualityCheck, transitionJob } from "@/server/modules/repairs/job.service";
import { markHandedOver, scheduleReturn } from "@/server/modules/repairs/return.service";
import { decideQuote, openDraft, processQuoteExpiry, saveDraft, sendQuote } from "@/server/modules/quotes/quote.service";
import { bookingInput, key, newCustomer, staff, tech, tech2 } from "../support/fixtures";

const LINES = {
  lines: [
    { kind: "PART", description: "Display assembly", quantity: 1, unitPaise: 349900, taxable: true },
    { kind: "LABOUR", description: "Labour", quantity: 1, unitPaise: 49900, taxable: true },
  ],
  customerMessage: "Screen replacement",
};

/** Booking → confirmed → received → inspected → diagnosed → quote sent. */
async function jobAwaitingDecision() {
  const customer = await newCustomer();
  const s = await staff();
  const t = await tech();
  const { reference } = await submitBooking(customer, await bookingInput(), key());
  const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference } });
  await confirmBooking(s, booking.id, { technicianId: t.userId });
  const job = await db.repairJob.findUniqueOrThrow({ where: { bookingId: booking.id } });

  await transitionJob(s, job.id, "DEVICE_RECEIVED");
  await recordInspection(t, job.id, { receiptCondition: "Cracked screen, frame intact", accessories: "None" });
  await recordDiagnosis(t, job.id, { findings: "Display damaged", recommendedRepair: "Replace display" });
  const versionId = await openDraft(s, job.id);
  const totals = await saveDraft(s, versionId, LINES);
  await sendQuote(s, versionId);
  return { customer, s, t, reference, jobId: job.id, versionId, totals };
}

const jobStatus = async (id: string) => (await db.repairJob.findUniqueOrThrow({ where: { id } })).status;

describe("repair lifecycle", () => {
  it("runs approve → repair → QC → return → completed, with warranty", async () => {
    const { customer, s, t, reference, jobId, versionId, totals } = await jobAwaitingDecision();
    expect(totals.totalPaise).toBe(Math.round((349900 + 49900) * 1.18));
    expect(await jobStatus(jobId)).toBe("AWAITING_DECISION");

    // Customer sees exactly the server's total.
    const view = await getMyBooking(customer, reference);
    expect(view.visibleQuote?.totalPaise).toBe(totals.totalPaise);

    await decideQuote(customer, versionId, { decision: "APPROVED" });
    expect(await jobStatus(jobId)).toBe("APPROVED");

    await transitionJob(t, jobId, "IN_PROGRESS");
    await transitionJob(t, jobId, "QUALITY_CHECK");
    await expect(transitionJob(t, jobId, "READY_FOR_RETURN")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await recordQualityCheck(t, jobId, { passed: true, notes: "All good" });
    await transitionJob(t, jobId, "READY_FOR_RETURN");

    const ret = await db.repairReturn.findFirstOrThrow({ where: { jobId } });
    expect(ret).toMatchObject({ reason: "COMPLETED", method: "DELIVERY", chargePaise: 0 });
    await markHandedOver(s, ret.id);

    expect(await jobStatus(jobId)).toBe("COMPLETED");
    expect(await db.repairWarranty.findUnique({ where: { jobId } })).not.toBeNull();

    const decision = await db.quoteDecision.findUniqueOrThrow({ where: { versionId } });
    expect(decision).toMatchObject({ decision: "APPROVED", customerId: customer.userId });
  });

  it("decline stops repair work and starts return coordination with the disclosed charge", async () => {
    const { customer, s, jobId, versionId } = await jobAwaitingDecision();
    await expect(decideQuote(customer, versionId, { decision: "DECLINED", returnMethod: "DELIVERY", acceptCharges: true })).rejects.toMatchObject({ code: "VALIDATION" });

    await decideQuote(customer, versionId, {
      decision: "DECLINED",
      returnMethod: "DELIVERY",
      acceptCharges: true,
      address: { addressLine1: "12 Test Street", pincode: "302017" },
    });
    expect(await jobStatus(jobId)).toBe("RETURN_COORDINATION");
    await expect(transitionJob(s, jobId, "IN_PROGRESS")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    const ret = await db.repairReturn.findFirstOrThrow({ where: { jobId } });
    expect(ret.reason).toBe("QUOTE_DECLINED");
    expect(ret.chargePaise).toBe(9900);
    expect(ret.acceptedAt).not.toBeNull();

    await scheduleReturn(s, ret.id, { scheduledAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(await jobStatus(jobId)).toBe("READY_FOR_RETURN");
    await markHandedOver(s, ret.id);
    expect(await jobStatus(jobId)).toBe("COMPLETED");
    expect(await db.repairWarranty.findUnique({ where: { jobId } })).toBeNull();
  });

  it("a revised quote supersedes the old one and needs fresh approval", async () => {
    const { customer, s, jobId, versionId } = await jobAwaitingDecision();
    const v2 = await openDraft(s, jobId);
    expect(v2).not.toBe(versionId);
    expect(await jobStatus(jobId)).toBe("QUOTE_PREPARED");
    expect((await db.quoteVersion.findUniqueOrThrow({ where: { id: versionId } })).status).toBe("SUPERSEDED");

    // Lines carry over into the revision.
    expect(await db.quoteLineItem.count({ where: { versionId: v2 } })).toBe(2);

    await expect(decideQuote(customer, versionId, { decision: "APPROVED" })).rejects.toMatchObject({ code: "QUOTE_NOT_ACTIONABLE" });
    await expect(decideQuote(customer, v2, { decision: "APPROVED" })).rejects.toMatchObject({ code: "QUOTE_NOT_ACTIONABLE" }); // still a draft

    await sendQuote(s, v2);
    await decideQuote(customer, v2, { decision: "APPROVED" });
    expect(await jobStatus(jobId)).toBe("APPROVED");
  });

  it("replaying the same decision is a no-op; a conflicting one is rejected", async () => {
    const { customer, versionId } = await jobAwaitingDecision();
    await decideQuote(customer, versionId, { decision: "APPROVED" });
    await expect(decideQuote(customer, versionId, { decision: "APPROVED" })).resolves.toMatchObject({ replay: true });
    await expect(
      decideQuote(customer, versionId, { decision: "DECLINED", returnMethod: "COLLECTION", acceptCharges: true }),
    ).rejects.toMatchObject({ code: "QUOTE_NOT_ACTIONABLE" });
  });

  it("expires unanswered quotes and blocks late approval", async () => {
    const { customer, jobId, versionId } = await jobAwaitingDecision();
    await db.quoteVersion.update({ where: { id: versionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(decideQuote(customer, versionId, { decision: "APPROVED" })).rejects.toMatchObject({ code: "QUOTE_NOT_ACTIONABLE" });

    await processQuoteExpiry();
    expect((await db.quoteVersion.findUniqueOrThrow({ where: { id: versionId } })).status).toBe("EXPIRED");
    expect(await jobStatus(jobId)).toBe("AWAITING_CUSTOMER_RESPONSE");

    // Re-running the cron is harmless.
    await processQuoteExpiry();
    expect(await jobStatus(jobId)).toBe("AWAITING_CUSTOMER_RESPONSE");
  });

  it("sends one reminder before expiry", async () => {
    const { versionId, customer } = await jobAwaitingDecision();
    await db.quoteVersion.update({ where: { id: versionId }, data: { expiresAt: new Date(Date.now() + 86_400_000) } });
    await processQuoteExpiry();
    await processQuoteExpiry();
    expect(await db.notificationEvent.count({ where: { recipientId: customer.userId, type: "quote.reminder" } })).toBe(1);
  });

  it("puts a job on hold and resumes to the previous status", async () => {
    const { s, jobId } = await jobAwaitingDecision();
    await expect(transitionJob(s, jobId, "ON_HOLD")).rejects.toMatchObject({ code: "VALIDATION" });
    await transitionJob(s, jobId, "ON_HOLD", "Waiting for part");
    expect(await jobStatus(jobId)).toBe("ON_HOLD");
    await transitionJob(s, jobId, "AWAITING_DECISION");
    expect(await jobStatus(jobId)).toBe("AWAITING_DECISION");
  });
});

describe("permissions", () => {
  it("staff cannot approve a quote on the customer's behalf", async () => {
    const { s, versionId } = await jobAwaitingDecision();
    await expect(decideQuote(s, versionId, { decision: "APPROVED" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("another customer cannot see or decide someone else's booking (IDOR)", async () => {
    const { reference, versionId } = await jobAwaitingDecision();
    const intruder: Actor = await newCustomer();
    await expect(getMyBooking(intruder, reference)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(decideQuote(intruder, versionId, { decision: "APPROVED" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a technician cannot move or even see a job assigned to someone else", async () => {
    const { jobId, customer, versionId } = await jobAwaitingDecision();
    await decideQuote(customer, versionId, { decision: "APPROVED" });
    const other = await tech2();
    await expect(transitionJob(other, jobId, "IN_PROGRESS")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a technician cannot send quotes", async () => {
    const { t, jobId } = await jobAwaitingDecision();
    await expect(openDraft(t, jobId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
