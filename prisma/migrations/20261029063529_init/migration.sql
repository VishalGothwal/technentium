-- CreateEnum
CREATE TYPE "LineItemKind" AS ENUM ('LABOUR', 'PART', 'DIAGNOSIS_FEE', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "HandoverMethod" AS ENUM ('PICKUP_DROP', 'WALK_IN', 'ONSITE', 'DROP_OFF_DELIVERY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('SUBMITTED', 'NEEDS_INFO', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('AWAITING_HANDOVER', 'DEVICE_RECEIVED', 'INSPECTION', 'QUOTE_PREPARED', 'AWAITING_DECISION', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_RETURN', 'COMPLETED', 'ON_HOLD', 'AWAITING_CUSTOMER_RESPONSE', 'QUOTE_DECLINED', 'RETURN_COORDINATION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('INTERNAL', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "AttachmentPurpose" AS ENUM ('BOOKING_PHOTO', 'RECEIPT_PHOTO', 'INSPECTION_PHOTO');

-- CreateEnum
CREATE TYPE "QuoteVersionStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'DECLINED', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuoteDecisionType" AS ENUM ('APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('COMPLETED', 'QUOTE_DECLINED');

-- CreateEnum
CREATE TYPE "ReturnMethod" AS ENUM ('COLLECTION', 'DELIVERY');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'SCHEDULED', 'HANDED_OVER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phoneNumber" TEXT,
    "phoneNumberVerified" BOOLEAN DEFAULT false,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factors" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "two_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_models" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_issue_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "descriptionEn" TEXT,
    "descriptionHi" TEXT,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_issue_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_items" (
    "id" TEXT NOT NULL,
    "kind" "LineItemKind" NOT NULL,
    "name" TEXT NOT NULL,
    "unitPaise" INTEGER NOT NULL,
    "partGrade" TEXT,
    "modelId" TEXT,
    "issueTypeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_fee_rules" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "modelId" TEXT,
    "issueTypeId" TEXT,
    "feePaise" INTEGER NOT NULL,
    "waivedIfApproved" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnosis_fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceable_areas" (
    "id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Jaipur',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serviceable_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_slots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_bookings" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "description" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'SUBMITTED',
    "handoverMethod" "HandoverMethod" NOT NULL,
    "slotId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "diagnosisFeePaise" INTEGER NOT NULL,
    "feeWaivedIfApproved" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "statusReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_booking_issues" (
    "bookingId" TEXT NOT NULL,
    "issueTypeId" TEXT NOT NULL,

    CONSTRAINT "repair_booking_issues_pkey" PRIMARY KEY ("bookingId","issueTypeId")
);

-- CreateTable
CREATE TABLE "repair_handover_details" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "pincode" TEXT,
    "city" TEXT,
    "notes" TEXT,

    CONSTRAINT "repair_handover_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_jobs" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'AWAITING_HANDOVER',
    "previousStatus" "JobStatus",
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "receivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "repairNotes" TEXT,
    "partsUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_assignments" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "repair_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_inspections" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "receiptCondition" TEXT NOT NULL,
    "accessories" TEXT,
    "checklist" JSONB,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_diagnoses" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "suspectedCause" TEXT,
    "recommendedRepair" TEXT,
    "partsRequired" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_quality_checks" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "checklist" JSONB,
    "passed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "checkedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_status_history" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "customerVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_job_notes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_job_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_attachments" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "purpose" "AttachmentPurpose" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "draftKey" TEXT,
    "bookingId" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_versions" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "QuoteVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "customerMessage" TEXT,
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" "LineItemKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPaise" INTEGER NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "priceItemId" TEXT,
    "partGrade" TEXT,
    "compatibilityNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_decisions" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "decision" "QuoteDecisionType" NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_returns" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "method" "ReturnMethod" NOT NULL,
    "chargePaise" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "pincode" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "handedOverAt" TIMESTAMP(3),
    "handedOverById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "termsEn" TEXT NOT NULL,
    "termsHi" TEXT,
    "days" INTEGER NOT NULL,
    "partGrade" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_warranties" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId","channel")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "two_factors_secret_idx" ON "two_factors"("secret");

-- CreateIndex
CREATE INDEX "two_factors_userId_idx" ON "two_factors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_userId_key" ON "customer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_userId_key" ON "staff_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "consent_records_userId_type_idx" ON "consent_records"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "device_categories_slug_key" ON "device_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "device_brands_categoryId_slug_key" ON "device_brands"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "device_models_categoryId_idx" ON "device_models"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "device_models_brandId_slug_key" ON "device_models"("brandId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "repair_issue_types_categoryId_slug_key" ON "repair_issue_types"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "price_items_modelId_issueTypeId_idx" ON "price_items"("modelId", "issueTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "serviceable_areas_pincode_key" ON "serviceable_areas"("pincode");

-- CreateIndex
CREATE INDEX "appointment_slots_date_idx" ON "appointment_slots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_slots_date_startTime_key" ON "appointment_slots"("date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "repair_bookings_reference_key" ON "repair_bookings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "repair_bookings_idempotencyKey_key" ON "repair_bookings"("idempotencyKey");

-- CreateIndex
CREATE INDEX "repair_bookings_status_createdAt_idx" ON "repair_bookings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "repair_bookings_customerId_idx" ON "repair_bookings"("customerId");

-- CreateIndex
CREATE INDEX "repair_bookings_handoverMethod_idx" ON "repair_bookings"("handoverMethod");

-- CreateIndex
CREATE UNIQUE INDEX "repair_handover_details_bookingId_key" ON "repair_handover_details"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "repair_jobs_reference_key" ON "repair_jobs"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "repair_jobs_bookingId_key" ON "repair_jobs"("bookingId");

-- CreateIndex
CREATE INDEX "repair_jobs_status_updatedAt_idx" ON "repair_jobs"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "repair_assignments_technicianId_active_idx" ON "repair_assignments"("technicianId", "active");

-- CreateIndex
CREATE INDEX "repair_assignments_jobId_active_idx" ON "repair_assignments"("jobId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "repair_inspections_jobId_key" ON "repair_inspections"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "repair_diagnoses_jobId_key" ON "repair_diagnoses"("jobId");

-- CreateIndex
CREATE INDEX "repair_quality_checks_jobId_idx" ON "repair_quality_checks"("jobId");

-- CreateIndex
CREATE INDEX "repair_status_history_bookingId_createdAt_idx" ON "repair_status_history"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "repair_status_history_entityType_entityId_idx" ON "repair_status_history"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "repair_job_notes_jobId_createdAt_idx" ON "repair_job_notes"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "repair_attachments_storageKey_key" ON "repair_attachments"("storageKey");

-- CreateIndex
CREATE INDEX "repair_attachments_bookingId_idx" ON "repair_attachments"("bookingId");

-- CreateIndex
CREATE INDEX "repair_attachments_jobId_idx" ON "repair_attachments"("jobId");

-- CreateIndex
CREATE INDEX "repair_attachments_uploadedById_draftKey_idx" ON "repair_attachments"("uploadedById", "draftKey");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_jobId_key" ON "quotes"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_activeVersionId_key" ON "quotes"("activeVersionId");

-- CreateIndex
CREATE INDEX "quote_versions_status_expiresAt_idx" ON "quote_versions"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "quote_versions_quoteId_number_key" ON "quote_versions"("quoteId", "number");

-- CreateIndex
CREATE INDEX "quote_line_items_versionId_idx" ON "quote_line_items"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_decisions_versionId_key" ON "quote_decisions"("versionId");

-- CreateIndex
CREATE INDEX "repair_returns_jobId_idx" ON "repair_returns"("jobId");

-- CreateIndex
CREATE INDEX "repair_returns_status_idx" ON "repair_returns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "repair_warranties_jobId_key" ON "repair_warranties"("jobId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_events_dedupeKey_key" ON "notification_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "notification_events_recipientId_createdAt_idx" ON "notification_events"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_nextAttemptAt_idx" ON "notification_deliveries"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_eventId_channel_key" ON "notification_deliveries"("eventId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "in_app_notifications_eventId_key" ON "in_app_notifications"("eventId");

-- CreateIndex
CREATE INDEX "in_app_notifications_userId_createdAt_idx" ON "in_app_notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_brands" ADD CONSTRAINT "device_brands_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "device_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "device_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "device_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_issue_types" ADD CONSTRAINT "repair_issue_types_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "device_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_issueTypeId_fkey" FOREIGN KEY ("issueTypeId") REFERENCES "repair_issue_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_fee_rules" ADD CONSTRAINT "diagnosis_fee_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "device_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_fee_rules" ADD CONSTRAINT "diagnosis_fee_rules_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_fee_rules" ADD CONSTRAINT "diagnosis_fee_rules_issueTypeId_fkey" FOREIGN KEY ("issueTypeId") REFERENCES "repair_issue_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_bookings" ADD CONSTRAINT "repair_bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_bookings" ADD CONSTRAINT "repair_bookings_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_bookings" ADD CONSTRAINT "repair_bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "appointment_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_booking_issues" ADD CONSTRAINT "repair_booking_issues_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "repair_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_booking_issues" ADD CONSTRAINT "repair_booking_issues_issueTypeId_fkey" FOREIGN KEY ("issueTypeId") REFERENCES "repair_issue_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_handover_details" ADD CONSTRAINT "repair_handover_details_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "repair_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "repair_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_assignments" ADD CONSTRAINT "repair_assignments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_assignments" ADD CONSTRAINT "repair_assignments_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_inspections" ADD CONSTRAINT "repair_inspections_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_diagnoses" ADD CONSTRAINT "repair_diagnoses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_quality_checks" ADD CONSTRAINT "repair_quality_checks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job_notes" ADD CONSTRAINT "repair_job_notes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_attachments" ADD CONSTRAINT "repair_attachments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "repair_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_attachments" ADD CONSTRAINT "repair_attachments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "quote_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "quote_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_priceItemId_fkey" FOREIGN KEY ("priceItemId") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_decisions" ADD CONSTRAINT "quote_decisions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_decisions" ADD CONSTRAINT "quote_decisions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_returns" ADD CONSTRAINT "repair_returns_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_warranties" ADD CONSTRAINT "repair_warranties_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_warranties" ADD CONSTRAINT "repair_warranties_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "warranty_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
