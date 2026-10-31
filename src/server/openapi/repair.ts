import { bookingSchema, diagnosisSchema, inspectionSchema, quoteDecisionSchema, quoteDraftSchema, reasonSchema } from "@/lib/schemas/repair";
import type { PathsObject } from "./types";
import { arr, bool, dateTime, fromZod, int, nullable, obj, pathId, query, str } from "./zod";

const category = obj({ id: str(), slug: str(), nameEn: str(), nameHi: nullable(str()) });
const device = obj({
  id: str(),
  slug: str(),
  name: str(),
  releaseYear: nullable(int()),
  popular: bool(),
  frame: nullable(str("2D outline family (camera layout), e.g. iphone-pro, galaxy-ultra, pixel-bar")),
  brand: obj({ id: str(), slug: str(), name: str() }),
  category,
});
const modelSummary = obj({ id: str(), slug: str(), name: str(), releaseYear: nullable(int()), popular: bool(), frame: nullable(str()) });
const bookingSummary = obj({
  reference: str("Human reference, e.g. TN-2610-00012"),
  status: str("Booking status: SUBMITTED | NEEDS_INFO | CONFIRMED | DECLINED | CANCELLED"),
  createdAt: dateTime(),
  handoverMethod: str(),
  model: obj({ name: str(), brand: obj({ name: str() }) }),
  job: nullable(obj({ status: str("Repair job status"), previousStatus: nullable(str()) })),
});
const uploaded = obj({ id: str() });
const tagDevices = ["Devices"];
const tagRepairs = ["Repairs"];
const tagAdmin = ["Admin · Repairs"];

/** Devices, booking, quotes and the staff repair endpoints (PRD §11.2–11.3). */
export const paths: PathsObject = {
  "/api/v1/devices/categories": { get: { tags: tagDevices, summary: "List device categories", security: "public", response: arr(category) } },
  "/api/v1/devices/brands": {
    get: {
      tags: tagDevices,
      summary: "List brands in a category",
      description: "Pass `categoryId` or the category slug as `category` (e.g. `phone`). Only brands with active models are listed.",
      security: "public",
      parameters: [query("categoryId", str(), "Device category id"), query("category", str(), "Device category slug, e.g. phone")],
      response: arr(obj({ id: str(), slug: str(), name: str(), _count: obj({ models: int() }) })),
    },
  },
  "/api/v1/devices/models": {
    get: {
      tags: tagDevices,
      summary: "List models of a brand",
      description: "Popular models first, then newest.",
      security: "public",
      parameters: [query("brandId", str(), "Brand id", true)],
      response: arr(modelSummary),
    },
  },
  "/api/v1/devices/catalog": {
    get: {
      tags: tagDevices,
      summary: "Full brand and model list for a category",
      description: "Every active brand with its models in one cached response — the fastest way to fill a device picker.",
      security: "public",
      parameters: [query("category", str(), "Device category slug, default phone")],
      response: obj({ category: str(), brands: arr(obj({ id: str(), slug: str(), name: str(), models: arr(modelSummary) })) }),
    },
  },
  "/api/v1/devices/models/{id}": { get: { tags: tagDevices, summary: "Get a device model", security: "public", parameters: [pathId()], response: device } },
  "/api/v1/devices/search": {
    get: {
      tags: tagDevices,
      summary: "Search all devices",
      description:
        "Free-text search across every brand and model (e.g. `galaxy ultra`, or shorthands like `s24u`, `15pm`). Filter by category, brand slug or launch year. With no `q`, `brand` or `year`, returns popular devices.",
      security: "public",
      parameters: [
        query("q", str(), "Search terms"),
        query("category", str(), "Category slug, e.g. phone"),
        query("categoryId", str(), "Category id"),
        query("brand", str(), "Brand slug, e.g. samsung"),
        query("year", int(), "Launch year, e.g. 2025"),
        query("limit", int(), "1–100, default 24"),
        query("offset", int(), "Skip this many results (paging)"),
      ],
      response: arr(device),
    },
  },
  "/api/v1/repair/issues": {
    get: {
      tags: tagRepairs,
      summary: "List repair issue types for a category",
      security: "public",
      parameters: [query("categoryId", str(), undefined, true)],
      response: arr(obj({ id: str(), slug: str(), nameEn: str(), nameHi: nullable(str()), descriptionEn: nullable(str()), descriptionHi: nullable(str()) })),
    },
  },
  "/api/v1/serviceability": {
    get: {
      tags: tagRepairs,
      summary: "Check whether a pincode is in the repair service area",
      security: "public",
      parameters: [query("pincode", str(undefined, { pattern: "^\\d{6}$" }), undefined, true)],
      response: obj({ serviceable: bool(), locality: str(), city: str() }),
    },
  },
  "/api/v1/appointment-slots": {
    get: {
      tags: tagRepairs,
      summary: "Available appointment slots (next 7 days)",
      security: "public",
      response: arr(obj({ id: str(), date: str("YYYY-MM-DD", { format: "date" }), startTime: str("HH:mm"), endTime: str("HH:mm"), remaining: int() })),
    },
  },
  "/api/v1/repair/diagnosis-fee": {
    get: {
      tags: tagRepairs,
      summary: "Preview the diagnosis fee for a device and issues",
      security: "public",
      parameters: [query("modelId", str(), undefined, true), query("issueTypeIds", str(), "Comma-separated issue type ids", true)],
      response: obj({ feePaise: int("Amount in paise (₹1 = 100)"), waivedIfApproved: bool("Fee is waived if the repair quote is approved"), ruleId: nullable(str()) }),
    },
  },
  "/api/v1/uploads/booking-photos": {
    post: {
      tags: tagRepairs,
      summary: "Upload an issue photo before submitting a booking",
      description: "JPEG/PNG/WebP up to 10 MB. The image is re-encoded and EXIF (including location) removed. Pass the returned ids as `attachmentIds` when submitting the booking.",
      security: "bearer",
      requestBody: { contentType: "multipart/form-data", schema: obj({ file: str("Image file", { format: "binary" }) }, ["file"]) },
      response: uploaded,
    },
  },
  "/api/v1/uploads/booking-photos/{id}": {
    delete: { tags: tagRepairs, summary: "Remove an unsubmitted booking photo", security: "bearer", parameters: [pathId()], response: obj({ removed: bool() }) },
  },
  "/api/v1/attachments/{id}": {
    get: {
      tags: tagRepairs,
      summary: "Download a repair photo",
      description: "Owner customer or authorised staff only; others receive 404. Returns the image bytes or a redirect to a short-lived signed URL.",
      security: "bearer",
      parameters: [pathId()],
    },
  },
  "/api/v1/repair/bookings": {
    get: { tags: tagRepairs, summary: "My repair bookings", security: "bearer", response: arr(bookingSummary) },
    post: {
      tags: tagRepairs,
      summary: "Submit a repair booking",
      description: "Requires an `Idempotency-Key` header (any unique string per booking attempt). Retrying with the same key returns the original booking instead of creating a duplicate.",
      security: "bearer",
      parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: str(undefined, { maxLength: 100 }) }],
      requestBody: { schema: fromZod(bookingSchema) },
      response: obj({ reference: str(), status: str() }),
    },
  },
  "/api/v1/repair/bookings/{reference}": {
    get: {
      tags: tagRepairs,
      summary: "Booking detail with job status, quote and timeline",
      description: "Only the owner can read a booking; any other reference returns 404.",
      security: "bearer",
      parameters: [pathId("reference")],
      response: obj({ reference: str(), status: str(), job: nullable(obj({ status: str(), quote: nullable(obj({})) })) }),
    },
  },
  "/api/v1/repair/bookings/{reference}/cancel": {
    post: { tags: tagRepairs, summary: "Cancel a booking before it is confirmed", security: "bearer", parameters: [pathId("reference")], response: obj({ cancelled: bool() }) },
  },
  "/api/v1/repair/quotes/{id}/decision": {
    post: {
      tags: tagRepairs,
      summary: "Approve or decline a quote",
      description: "Applies only to the active, sent, unexpired version. Declining requires choosing how the device comes back; the return charge was disclosed with the quote.",
      security: "bearer",
      parameters: [pathId("id", "Quote version id")],
      requestBody: { schema: fromZod(quoteDecisionSchema) },
      response: obj({ decision: str() }),
    },
  },

  // ───────────── Staff ─────────────
  "/api/v1/admin/repair/bookings/{id}/confirm": {
    post: {
      tags: tagAdmin,
      summary: "Confirm a booking (creates the repair job)",
      description: "Permission `booking.confirm`. Re-checks slot capacity atomically.",
      security: "staff",
      parameters: [pathId()],
      requestBody: { schema: obj({ technicianId: str("Optional technician to assign") }) },
      response: obj({ confirmed: bool() }),
    },
  },
  "/api/v1/admin/repair/bookings/{id}/decline": {
    post: {
      tags: tagAdmin,
      summary: "Decline a booking",
      security: "staff",
      parameters: [pathId()],
      requestBody: { schema: obj({ reason: fromZod(reasonSchema) }, ["reason"]) },
      response: obj({ declined: bool() }),
    },
  },
  "/api/v1/admin/repair/bookings/{id}/reschedule": {
    post: {
      tags: tagAdmin,
      summary: "Reschedule a confirmed booking",
      security: "staff",
      parameters: [pathId()],
      requestBody: { schema: obj({ slotId: str(), reason: fromZod(reasonSchema) }, ["slotId", "reason"]) },
      response: obj({ rescheduled: bool() }),
    },
  },
  "/api/v1/admin/repair/jobs/{id}/status": {
    post: {
      tags: tagAdmin,
      summary: "Move a job to another status",
      description: "Transition rules, guards and the technician assignment restriction are enforced by the server state machine.",
      security: "staff",
      parameters: [pathId()],
      requestBody: { schema: obj({ to: str("Target JobStatus"), reason: str("Required for hold and QC failure") }, ["to"]) },
      response: obj({ status: str() }),
    },
  },
  "/api/v1/admin/repair/jobs/{id}/inspection": {
    post: { tags: tagAdmin, summary: "Record receipt condition and inspection", security: "staff", parameters: [pathId()], requestBody: { schema: fromZod(inspectionSchema) }, response: obj({ saved: bool() }) },
  },
  "/api/v1/admin/repair/jobs/{id}/diagnosis": {
    post: { tags: tagAdmin, summary: "Record the diagnosis", security: "staff", parameters: [pathId()], requestBody: { schema: fromZod(diagnosisSchema) }, response: obj({ saved: bool() }) },
  },
  "/api/v1/admin/jobs/{id}/photos": {
    post: {
      tags: tagAdmin,
      summary: "Upload receipt or inspection photos",
      security: "staff",
      parameters: [pathId()],
      requestBody: { contentType: "multipart/form-data", schema: obj({ file: str(undefined, { format: "binary" }), purpose: { type: "string", enum: ["RECEIPT_PHOTO", "INSPECTION_PHOTO"] } }, ["file", "purpose"]) },
      response: uploaded,
    },
  },
  "/api/v1/admin/repair/jobs/{id}/quotes": {
    post: { tags: tagAdmin, summary: "Open the editable quote draft", description: "Revising a sent quote supersedes it; the customer must approve again.", security: "staff", parameters: [pathId()] },
  },
  "/api/v1/admin/repair/quotes/{id}": {
    put: {
      tags: tagAdmin,
      summary: "Save quote draft lines",
      description: "Totals (discounts, GST) are computed on the server; client totals are ignored.",
      security: "staff",
      parameters: [pathId("id", "Quote version id")],
      requestBody: { schema: fromZod(quoteDraftSchema) },
      response: obj({ subtotalPaise: int(), discountPaise: int(), taxPaise: int(), totalPaise: int() }),
    },
  },
  "/api/v1/admin/repair/quotes/{id}/send": {
    post: { tags: tagAdmin, summary: "Send the quote to the customer", description: "Freezes the version and starts the expiry clock.", security: "staff", parameters: [pathId("id", "Quote version id")] },
  },
};

