/**
 * Role → permission baseline from PRD §8 (decision D-10: proposed matrix adopted as baseline).
 * This file is the single source of truth; `prisma/seed.ts` writes it into roles/permissions tables,
 * and the runtime resolves permissions from the database so an Owner can adjust them later.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "booking.view_all",
  "booking.confirm",
  "booking.decline",
  "booking.request_info",
  "booking.reschedule",
  "booking.cancel",
  "job.view_all",
  "job.view_assigned",
  "job.assign",
  "job.transition", // any permitted transition on any job
  "job.transition_assigned", // technician stages on jobs assigned to them
  "job.inspect",
  "job.diagnose",
  "job.note",
  "job.quality_check",
  "quote.manage", // create, edit draft, send, revise
  "quote.diagnosis_input", // technicians contribute diagnosis, not prices
  "return.manage",
  "return.handover_assigned",
  "customer.view",
  "customer.view_assigned",
  "catalog.manage",
  "settings.manage",
  "settings.fees",
  "team.manage",
  "audit.view_all",
  "audit.view_limited",
  "notification.view_log",
  // Protection products & order requests (PRD §6.6)
  "product.manage", // create/edit/archive products, images, compatibility
  "inventory.manage", // stock adjustments and thresholds
  "product_request.manage", // review, confirm and fulfil order requests
  // Customization (PRD §6.7)
  "customization.manage",
  "customization.technical_input", // comment on assigned requests
  // Content (PRD §6.8–6.9)
  "content.edit", // articles, videos, specifications, comparisons
  "content.publish",
  "media.upload", // public images for products/designs/content
  // Accounts & platform controls
  "user.manage", // edit any account's profile, block, reset password / two-factor, sign out everywhere
  "user.impersonate", // "switch user": view and act as another (non-owner) account, audited
  "system.features", // feature controls: sign-in methods, site sections, test mode, maintenance
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = ["owner", "staff", "technician", "editor", "inventory"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_DEFINITIONS: Record<RoleKey, { name: string; description: string; permissions: readonly Permission[] }> = {
  owner: {
    name: "Owner",
    description: "Full access to operations, settings, team and audit history.",
    permissions: PERMISSIONS,
  },
  staff: {
    name: "Operations staff",
    description: "Confirms bookings, coordinates handover, issues quotes and manages returns.",
    permissions: [
      "dashboard.view",
      "booking.view_all",
      "booking.confirm",
      "booking.decline",
      "booking.request_info",
      "booking.reschedule",
      "booking.cancel",
      "job.view_all",
      "job.assign",
      "job.transition",
      "job.inspect",
      "job.note",
      "quote.manage",
      "return.manage",
      "customer.view",
      "audit.view_limited",
      "notification.view_log",
      "product_request.manage",
      "customization.manage",
      "media.upload",
    ],
  },
  technician: {
    name: "Technician",
    description: "Inspects, diagnoses and repairs assigned devices.",
    permissions: [
      "dashboard.view",
      "job.view_assigned",
      "job.transition_assigned",
      "job.inspect",
      "job.diagnose",
      "job.note",
      "job.quality_check",
      "quote.diagnosis_input",
      "return.handover_assigned",
      "customer.view_assigned",
      "customization.technical_input",
    ],
  },
  editor: {
    name: "Content editor",
    description: "Creates and publishes articles, videos and specifications.",
    permissions: ["dashboard.view", "content.edit", "content.publish", "media.upload", "audit.view_limited"],
  },
  inventory: {
    name: "Inventory manager",
    description: "Maintains products, compatibility and stock, and processes order requests.",
    permissions: ["dashboard.view", "product.manage", "inventory.manage", "product_request.manage", "media.upload", "audit.view_limited"],
  },
};
