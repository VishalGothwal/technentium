import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  cancelMyBooking,
  confirmBooking,
  declineBooking,
  getMyBooking,
  requestBookingInfo,
  respondToInfoRequest,
  submitBooking,
} from "@/server/modules/repairs/booking.service";
import { bookingInput, key, newCustomer, newSlot, staff, tech } from "../support/fixtures";

describe("booking submission", () => {
  it("creates one booking with a reference, pending confirmation, and a notification", async () => {
    const customer = await newCustomer();
    const res = await submitBooking(customer, await bookingInput(), key());
    expect(res.reference).toMatch(/^TN-\d{4}-\d{5}$/);

    const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference: res.reference }, include: { issues: true, handover: true } });
    expect(booking.status).toBe("SUBMITTED");
    expect(booking.issues).toHaveLength(1);
    expect(booking.handover?.pincode).toBe("302017");
    expect(booking.diagnosisFeePaise).toBeGreaterThan(0);

    const event = await db.notificationEvent.findFirstOrThrow({ where: { recipientId: customer.userId, type: "booking.submitted" }, include: { deliveries: true } });
    expect(event.deliveries.map((d) => d.channel).sort()).toEqual(["email", "in_app"]);
  });

  it("is idempotent: retrying with the same key returns the same booking", async () => {
    const customer = await newCustomer();
    const input = await bookingInput();
    const k = key();
    const first = await submitBooking(customer, input, k);
    const second = await submitBooking(customer, input, k);
    expect(second).toEqual({ reference: first.reference, duplicate: true });
    expect(await db.repairBooking.count({ where: { customerId: customer.userId } })).toBe(1);
  });

  it("rejects unauthenticated submissions", async () => {
    await expect(submitBooking(null, await bookingInput(), key())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects addresses outside the Jaipur service area", async () => {
    const customer = await newCustomer();
    const input = await bookingInput({ address: { addressLine1: "1 Somewhere Road", pincode: "110001" } });
    await expect(submitBooking(customer, input, key())).rejects.toMatchObject({ code: "UNSERVICEABLE" });
  });

  it("requires an address for pickup and accepts walk-in without one", async () => {
    const customer = await newCustomer();
    await expect(submitBooking(customer, await bookingInput({ address: undefined }), key())).rejects.toMatchObject({ code: "VALIDATION" });
    const ok = await submitBooking(customer, await bookingInput({ handoverMethod: "WALK_IN", address: undefined }), key());
    expect(ok.reference).toBeTruthy();
  });

  it("requires policy acceptance", async () => {
    const customer = await newCustomer();
    const input = { ...(await bookingInput()), acceptPolicy: false } as never;
    await expect(submitBooking(customer, input, key())).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("staff confirmation", () => {
  it("confirms a booking, creates the job and assigns a technician", async () => {
    const customer = await newCustomer();
    const { reference } = await submitBooking(customer, await bookingInput(), key());
    const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference } });
    const t = await tech();

    await confirmBooking(await staff(), booking.id, { technicianId: t.userId });

    const job = await db.repairJob.findUniqueOrThrow({ where: { bookingId: booking.id }, include: { assignments: true } });
    expect(job.status).toBe("AWAITING_HANDOVER");
    expect(job.reference).toBe(reference);
    expect(job.assignments[0]?.technicianId).toBe(t.userId);
  });

  it("enforces slot capacity at confirmation", async () => {
    const slot = await newSlot(1);
    const s = await staff();
    const a = await submitBooking(await newCustomer(), await bookingInput({ slotId: slot.id }), key());
    const b = await submitBooking(await newCustomer(), await bookingInput({ slotId: slot.id }), key());
    const [ba, bb] = await Promise.all([a, b].map((x) => db.repairBooking.findUniqueOrThrow({ where: { reference: x.reference } })));

    await confirmBooking(s, ba.id);
    await expect(confirmBooking(s, bb.id)).rejects.toMatchObject({ code: "SLOT_FULL" });
  });

  it("does not let two concurrent confirmations both succeed", async () => {
    const customer = await newCustomer();
    const { reference } = await submitBooking(customer, await bookingInput(), key());
    const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference } });
    const s = await staff();
    const results = await Promise.allSettled([confirmBooking(s, booking.id), confirmBooking(s, booking.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.repairJob.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it("declines with a reason the customer can see", async () => {
    const customer = await newCustomer();
    const { reference } = await submitBooking(customer, await bookingInput(), key());
    const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference } });
    await expect(declineBooking(await staff(), booking.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
    await declineBooking(await staff(), booking.id, "Model not supported yet");
    const view = await getMyBooking(customer, reference);
    expect(view.status).toBe("DECLINED");
    expect(view.history.at(-1)?.reason).toBe("Model not supported yet");
  });

  it("supports a clarification round-trip", async () => {
    const customer = await newCustomer();
    const { reference } = await submitBooking(customer, await bookingInput(), key());
    const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference } });
    await requestBookingInfo(await staff(), booking.id, "Which colour is your phone?");
    await respondToInfoRequest(customer, reference, "It is the blue one");
    const after = await db.repairBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe("SUBMITTED");
    expect(after.description).toContain("blue one");
  });

  it("lets customers cancel only before confirmation", async () => {
    const customer = await newCustomer();
    const { reference } = await submitBooking(customer, await bookingInput(), key());
    const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference } });
    await confirmBooking(await staff(), booking.id);
    await expect(cancelMyBooking(customer, reference)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("forbids technicians from confirming bookings", async () => {
    const customer = await newCustomer();
    const { reference } = await submitBooking(customer, await bookingInput(), key());
    const booking = await db.repairBooking.findUniqueOrThrow({ where: { reference } });
    await expect(confirmBooking(await tech(), booking.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
