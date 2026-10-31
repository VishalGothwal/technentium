import { describe, expect, it } from "vitest";
import {
  actorMayApply,
  customerStep,
  findBookingRule,
  findJobRule,
  JOB_RULES,
  manualTargets,
  resumeTarget,
  TERMINAL_JOB_STATUSES,
} from "@/server/modules/repairs/state-machine";

const staff = { hasStaffTransition: true, hasAssignedTransition: false, isAssigned: false, system: false };
const tech = { hasStaffTransition: false, hasAssignedTransition: true, isAssigned: true, system: false };
const unassignedTech = { ...tech, isAssigned: false };
const system = { hasStaffTransition: false, hasAssignedTransition: false, isAssigned: false, system: true };

describe("job transitions", () => {
  it("follows the happy path", () => {
    const path = [
      "AWAITING_HANDOVER",
      "DEVICE_RECEIVED",
      "INSPECTION",
      "QUOTE_PREPARED",
      "AWAITING_DECISION",
      "APPROVED",
      "IN_PROGRESS",
      "QUALITY_CHECK",
      "READY_FOR_RETURN",
      "COMPLETED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(findJobRule(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBeDefined();
    }
  });

  it("follows the decline path", () => {
    expect(findJobRule("AWAITING_DECISION", "QUOTE_DECLINED")).toBeDefined();
    expect(findJobRule("QUOTE_DECLINED", "RETURN_COORDINATION")).toBeDefined();
    expect(findJobRule("RETURN_COORDINATION", "READY_FOR_RETURN")).toBeDefined();
  });

  it("never allows repair work after a decline or without approval", () => {
    expect(findJobRule("QUOTE_DECLINED", "IN_PROGRESS")).toBeUndefined();
    expect(findJobRule("RETURN_COORDINATION", "IN_PROGRESS")).toBeUndefined();
    expect(findJobRule("AWAITING_DECISION", "IN_PROGRESS")).toBeUndefined();
    expect(findJobRule("QUOTE_PREPARED", "APPROVED")).toBeUndefined();
    expect(findJobRule("APPROVED", "IN_PROGRESS")?.guard).toBe("approvedQuote");
  });

  it("customer decisions are system-only (staff cannot approve on the customer's behalf)", () => {
    const approve = findJobRule("AWAITING_DECISION", "APPROVED")!;
    const decline = findJobRule("AWAITING_DECISION", "QUOTE_DECLINED")!;
    for (const rule of [approve, decline]) {
      expect(rule.by).toEqual(["system"]);
      expect(actorMayApply(rule, staff)).toBe(false);
      expect(actorMayApply(rule, system)).toBe(true);
    }
  });

  it("revising a quote returns to QUOTE_PREPARED", () => {
    expect(findJobRule("AWAITING_DECISION", "QUOTE_PREPARED")).toBeDefined();
    expect(findJobRule("IN_PROGRESS", "QUOTE_PREPARED")).toBeDefined();
  });

  it("has no transitions out of terminal states", () => {
    for (const rule of JOB_RULES) {
      for (const t of TERMINAL_JOB_STATUSES) expect(rule.from).not.toContain(t);
    }
  });

  it("restricts technicians to assigned jobs", () => {
    const rule = findJobRule("APPROVED", "IN_PROGRESS")!;
    expect(actorMayApply(rule, tech)).toBe(true);
    expect(actorMayApply(rule, unassignedTech)).toBe(false);
    expect(actorMayApply(findJobRule("RETURN_COORDINATION", "READY_FOR_RETURN")!, tech)).toBe(false);
  });

  it("requires reasons for hold and QC failure", () => {
    expect(findJobRule("IN_PROGRESS", "ON_HOLD")?.requiresReason).toBe(true);
    expect(findJobRule("QUALITY_CHECK", "IN_PROGRESS")?.requiresReason).toBe(true);
  });

  it("resumes from hold only to the previous status", () => {
    expect(resumeTarget("ON_HOLD", "IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(resumeTarget("IN_PROGRESS", "APPROVED")).toBeNull();
    expect(findJobRule("ON_HOLD", "IN_PROGRESS")).toBeUndefined();
  });

  it("lists manual targets per actor", () => {
    expect(manualTargets("APPROVED", null, staff)).toEqual(expect.arrayContaining(["IN_PROGRESS", "ON_HOLD"]));
    expect(manualTargets("APPROVED", null, tech)).toEqual(["IN_PROGRESS"]);
    expect(manualTargets("AWAITING_DECISION", null, tech)).toEqual([]);
    expect(manualTargets("ON_HOLD", "QUALITY_CHECK", staff)).toEqual(["QUALITY_CHECK"]);
    expect(manualTargets("AWAITING_DECISION", null, staff)).not.toContain("APPROVED");
  });
});

describe("booking transitions", () => {
  it("allows staff confirmation, decline, info request", () => {
    expect(findBookingRule("SUBMITTED", "CONFIRMED")?.by).toEqual(["staff"]);
    expect(findBookingRule("SUBMITTED", "DECLINED")?.requiresReason).toBe(true);
    expect(findBookingRule("SUBMITTED", "NEEDS_INFO")?.requiresReason).toBe(true);
  });
  it("lets customers respond and cancel before confirmation only", () => {
    expect(findBookingRule("NEEDS_INFO", "SUBMITTED")?.by).toEqual(["customer"]);
    expect(findBookingRule("SUBMITTED", "CANCELLED")?.by).toContain("customer");
    expect(findBookingRule("CONFIRMED", "CANCELLED")?.by).toEqual(["staff"]);
  });
  it("does not reopen declined or cancelled bookings", () => {
    expect(findBookingRule("DECLINED", "SUBMITTED")).toBeUndefined();
    expect(findBookingRule("CANCELLED", "SUBMITTED")).toBeUndefined();
  });
});

describe("customer step mapping", () => {
  it("maps internal states to simple customer steps", () => {
    expect(customerStep("SUBMITTED", null)).toBe("submitted");
    expect(customerStep("CONFIRMED", "AWAITING_HANDOVER")).toBe("confirmed");
    expect(customerStep("CONFIRMED", "QUOTE_PREPARED")).toBe("diagnosis");
    expect(customerStep("CONFIRMED", "AWAITING_DECISION")).toBe("decision");
    expect(customerStep("CONFIRMED", "ON_HOLD", "IN_PROGRESS")).toBe("repair");
    expect(customerStep("CONFIRMED", "RETURN_COORDINATION")).toBe("decision");
    expect(customerStep("CONFIRMED", "COMPLETED")).toBe("completed");
  });
});
