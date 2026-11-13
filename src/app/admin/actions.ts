"use server";
/**
 * Admin Server Actions. Thin: every function delegates to a service that performs its own
 * authorisation, so calling these directly (e.g. from a crafted request) grants nothing extra.
 */
import type { JobStatus } from "@/generated/prisma/enums";
import { updateTag } from "next/cache";
import { runAction } from "@/server/actions";
import {
  confirmBooking,
  declineBooking,
  requestBookingInfo,
  rescheduleBooking,
  staffCancelBooking,
} from "@/server/modules/repairs/booking.service";
import {
  addJobNote,
  assignTechnician,
  recordDiagnosis,
  recordInspection,
  recordQualityCheck,
  recordRepairWork,
  setPriority,
  transitionJob,
} from "@/server/modules/repairs/job.service";
import { markHandedOver, scheduleReturn } from "@/server/modules/repairs/return.service";
import { openDraft, saveDraft, sendQuote } from "@/server/modules/quotes/quote.service";
import {
  generateSlots,
  updateSettings,
  updateSlot,
  upsertArea,
  upsertFeeRule,
  upsertWarrantyPolicy,
} from "@/server/modules/settings/admin-settings.service";
import { importModelsCsv, upsertBrand, upsertEstimate, upsertIssue, upsertModel, upsertPriceItem } from "@/server/modules/catalog/catalog-admin.service";
import { DEVICES_TAG } from "@/server/modules/catalog/devices.cached";
import { inviteStaff, setStaffActive, setStaffRoles } from "@/server/modules/team/team.service";
import { dispatchDeliveries } from "@/server/notifications/dispatch";
import { db } from "@/server/db";
import { assertCan } from "@/server/rbac/actor";
import type { RoleKey } from "@/server/rbac/permissions";

// Bookings
export const confirmBookingAction = async (bookingId: string, technicianId?: string | null) =>
  runAction((a) => confirmBooking(a, bookingId, { technicianId: technicianId || null }));
export const declineBookingAction = async (bookingId: string, reason: string) => runAction((a) => declineBooking(a, bookingId, reason));
export const requestInfoAction = async (bookingId: string, reason: string) => runAction((a) => requestBookingInfo(a, bookingId, reason));
export const rescheduleBookingAction = async (bookingId: string, slotId: string, reason: string) =>
  runAction((a) => rescheduleBooking(a, bookingId, slotId, reason));
export const cancelBookingStaffAction = async (bookingId: string, reason: string) => runAction((a) => staffCancelBooking(a, bookingId, reason));

// Jobs
export const transitionJobAction = async (jobId: string, to: JobStatus, reason?: string) => runAction((a) => transitionJob(a, jobId, to, reason));
export const assignTechnicianAction = async (jobId: string, technicianId: string) => runAction((a) => assignTechnician(a, jobId, technicianId));
export const setPriorityAction = async (jobId: string, priority: "LOW" | "NORMAL" | "HIGH" | "URGENT") => runAction((a) => setPriority(a, jobId, priority));
export const recordInspectionAction = async (jobId: string, input: unknown) => runAction((a) => recordInspection(a, jobId, input));
export const recordDiagnosisAction = async (jobId: string, input: unknown) => runAction((a) => recordDiagnosis(a, jobId, input));
export const recordQualityCheckAction = async (jobId: string, input: unknown) => runAction((a) => recordQualityCheck(a, jobId, input));
export const recordRepairWorkAction = async (jobId: string, input: { repairNotes?: string; partsUsed?: string }) =>
  runAction((a) => recordRepairWork(a, jobId, input));
export const addJobNoteAction = async (jobId: string, input: unknown) => runAction((a) => addJobNote(a, jobId, input));

// Quotes
export const openDraftAction = async (jobId: string) => runAction((a) => openDraft(a, jobId));
export const saveDraftAction = async (versionId: string, input: unknown) => runAction((a) => saveDraft(a, versionId, input));
export const sendQuoteAction = async (versionId: string) => runAction((a) => sendQuote(a, versionId));

// Returns
export const scheduleReturnAction = async (returnId: string, input: { scheduledAt: string; notes?: string }) => runAction((a) => scheduleReturn(a, returnId, input));
export const markHandedOverAction = async (returnId: string, notes?: string) => runAction((a) => markHandedOver(a, returnId, notes));

// Settings & catalogue
// Settings feed the cached header (support phone, WhatsApp), so saving refreshes it too.
export const updateSettingsAction = async (changes: Record<string, unknown>) => runAction((a) => refreshingDevices(() => updateSettings(a, changes)));
export const upsertAreaAction = async (input: unknown) => runAction((a) => upsertArea(a, input));
export const generateSlotsAction = async (input: unknown) => runAction((a) => generateSlots(a, input));
export const updateSlotAction = async (slotId: string, input: { capacity?: number; active?: boolean }) => runAction((a) => updateSlot(a, slotId, input));
export const upsertFeeRuleAction = async (input: unknown) => runAction((a) => upsertFeeRule(a, input));
export const upsertWarrantyPolicyAction = async (input: unknown) => runAction((a) => upsertWarrantyPolicy(a, input));
/** Device catalogue edits refresh the cached pickers, header menus and device API immediately. */
async function refreshingDevices<T>(fn: () => Promise<T>) {
  const res = await fn();
  updateTag(DEVICES_TAG);
  return res;
}
export const upsertBrandAction = async (input: unknown) => runAction((a) => refreshingDevices(() => upsertBrand(a, input)));
export const upsertModelAction = async (input: unknown) => runAction((a) => refreshingDevices(() => upsertModel(a, input)));
export const importModelsCsvAction = async (input: unknown) => runAction((a) => refreshingDevices(() => importModelsCsv(a, input)));
export const upsertIssueAction = async (input: unknown) => runAction((a) => upsertIssue(a, input));
export const upsertPriceItemAction = async (input: unknown) => runAction((a) => upsertPriceItem(a, input));
export const upsertEstimateAction = async (input: unknown) => runAction((a) => upsertEstimate(a, input));

// Team
export const inviteStaffAction = async (input: unknown) => runAction((a) => inviteStaff(a, input));
export const setStaffRolesAction = async (userId: string, roles: RoleKey[]) => runAction((a) => setStaffRoles(a, userId, roles));
export const setStaffActiveAction = async (userId: string, active: boolean) => runAction((a) => setStaffActive(a, userId, active));

// Notifications
export const retryDeliveryAction = async (deliveryId: string) =>
  runAction(async (a) => {
    assertCan(a, "notification.view_log");
    await db.notificationDelivery.updateMany({
      where: { id: deliveryId, status: "FAILED" },
      data: { nextAttemptAt: new Date(), attempts: 0 },
    });
    await dispatchDeliveries([deliveryId]);
  });
