import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { loadActor } from "@/server/auth/session";
import type { Actor } from "@/server/rbac/actor";
import type { BookingInput } from "@/lib/schemas/repair";

export async function actorByEmail(email: string): Promise<Actor> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return (await loadActor(user.id))!;
}

export const owner = () => actorByEmail("owner@technentium.test");
export const staff = () => actorByEmail("staff@technentium.test");
export const tech = () => actorByEmail("tech@technentium.test");
export const tech2 = () => actorByEmail("tech2@technentium.test");

/** A fresh customer per test so tests don't depend on each other. */
export async function newCustomer(): Promise<Actor> {
  const id = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { email: `cust-${id}@example.test`, name: `Customer ${id}`, emailVerified: true, customerProfile: { create: {} } },
  });
  return (await loadActor(user.id))!;
}

/** A dedicated slot with the given capacity so capacity tests are deterministic. */
export async function newSlot(capacity = 4) {
  // Always a brand-new slot (random future date + time) so earlier runs' bookings never count against it.
  for (;;) {
    const date = new Date(Date.now() + (3 + Math.floor(Math.random() * 3000)) * 86_400_000);
    date.setUTCHours(0, 0, 0, 0);
    const startTime = `${String(Math.floor(Math.random() * 24)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
    const exists = await db.appointmentSlot.findUnique({ where: { date_startTime: { date, startTime } } });
    if (!exists) return db.appointmentSlot.create({ data: { date, startTime, endTime: "23:59", capacity } });
  }
}

export async function bookingInput(overrides: Partial<BookingInput> = {}): Promise<BookingInput> {
  const model = await db.deviceModel.findFirstOrThrow({ where: { slug: "iphone-13" } });
  const issue = await db.repairIssueType.findFirstOrThrow({ where: { slug: "broken-or-cracked-screen", categoryId: model.categoryId } });
  const slot = await newSlot();
  return {
    modelId: model.id,
    issueTypeIds: [issue.id],
    description: "Dropped it, screen cracked",
    attachmentIds: [],
    handoverMethod: "PICKUP_DROP",
    address: { addressLine1: "12 Test Street, Malviya Nagar", pincode: "302017", addressLine2: "", landmark: "" },
    slotId: slot.id,
    contactName: "Test Customer",
    contactPhone: "9876543210",
    acceptPolicy: true,
    ...overrides,
  };
}

export const key = () => randomUUID();
