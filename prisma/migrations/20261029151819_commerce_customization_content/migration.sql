-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('PRODUCT_IMAGE', 'DESIGN_IMAGE', 'CONTENT_IMAGE', 'DEVICE_IMAGE', 'CUSTOM_ARTWORK');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryMovementReason" AS ENUM ('RECEIVED', 'ADJUSTMENT', 'REQUEST_FULFILLED', 'RETURNED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'FULFILLING', 'SHIPPED', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DesignOptionKind" AS ENUM ('FINISH', 'COVERAGE');

-- CreateEnum
CREATE TYPE "CustomizationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'FEASIBILITY_CONFIRMED', 'QUOTE_SHARED', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ARTICLE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentRelationTarget" AS ENUM ('CONTENT', 'PRODUCT', 'PRODUCT_CATEGORY', 'REPAIR_CATEGORY', 'DEVICE_SPEC', 'COMPARISON');

-- AlterTable
ALTER TABLE "device_models" ADD COLUMN     "popular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releaseYear" INTEGER;

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "purpose" "MediaPurpose" NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "altEn" TEXT,
    "altHi" TEXT,
    "uploadedById" TEXT NOT NULL,
    "draftKey" TEXT,
    "customizationRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "descriptionEn" TEXT,
    "descriptionHi" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "summaryEn" TEXT,
    "summaryHi" TEXT,
    "descriptionEn" TEXT,
    "descriptionHi" TEXT,
    "categoryId" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "mrpPaise" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "universal" BOOLEAN NOT NULL DEFAULT false,
    "specs" JSONB NOT NULL DEFAULT '[]',
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_device_compatibility" (
    "productId" TEXT NOT NULL,
    "deviceModelId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "product_device_compatibility_pkey" PRIMARY KEY ("productId","deviceModelId")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "productId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "reason" "InventoryMovementReason" NOT NULL,
    "note" TEXT,
    "requestId" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "deviceModelId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "customerNotes" TEXT,
    "subtotalPaise" INTEGER NOT NULL,
    "shippingPaise" INTEGER,
    "totalPaise" INTEGER,
    "trackingInfo" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "deviceModelId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "confirmedQuantity" INTEGER,

    CONSTRAINT "product_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_request_status_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "ProductRequestStatus",
    "toStatus" "ProductRequestStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "customerVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_request_notes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_request_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "descriptionEn" TEXT,
    "descriptionHi" TEXT,
    "collection" TEXT NOT NULL,
    "style" JSONB NOT NULL DEFAULT '{}',
    "previewMediaId" TEXT,
    "basePricePaise" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_options" (
    "id" TEXT NOT NULL,
    "kind" "DesignOptionKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "descriptionEn" TEXT,
    "descriptionHi" TEXT,
    "priceDeltaPaise" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deviceModelId" TEXT NOT NULL,
    "designId" TEXT,
    "finishOptionId" TEXT NOT NULL,
    "coverageOptionId" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "customerNotes" TEXT,
    "status" "CustomizationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "estimatePaise" INTEGER,
    "quotedPaise" INTEGER,
    "nextSteps" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_status_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "CustomizationStatus",
    "toStatus" "CustomizationStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "customerVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customization_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_notes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customization_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "slug" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorId" TEXT NOT NULL,
    "coverMediaId" TEXT,
    "videoUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" JSONB NOT NULL DEFAULT '[]',
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "readingMinutes" INTEGER NOT NULL DEFAULT 1,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" TEXT NOT NULL,
    "translationId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_relations" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "targetType" "ContentRelationTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_specifications" (
    "id" TEXT NOT NULL,
    "deviceModelId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "releaseDate" TIMESTAMP(3),
    "launchPricePaise" INTEGER,
    "summaryEn" TEXT,
    "summaryHi" TEXT,
    "specs" JSONB NOT NULL DEFAULT '[]',
    "imageMediaId" TEXT,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_comparisons" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleHi" TEXT,
    "introEn" TEXT,
    "introHi" TEXT,
    "verdictEn" TEXT,
    "verdictHi" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_devices" (
    "comparisonId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "comparison_devices_pkey" PRIMARY KEY ("comparisonId","specId")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_uploadedById_draftKey_idx" ON "media_assets"("uploadedById", "draftKey");

-- CreateIndex
CREATE INDEX "media_assets_customizationRequestId_idx" ON "media_assets"("customizationRequestId");

-- CreateIndex
CREATE INDEX "media_assets_purpose_createdAt_idx" ON "media_assets"("purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_categoryId_status_idx" ON "products"("categoryId", "status");

-- CreateIndex
CREATE INDEX "products_status_featured_idx" ON "products"("status", "featured");

-- CreateIndex
CREATE INDEX "product_images_productId_sortOrder_idx" ON "product_images"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_device_compatibility_deviceModelId_idx" ON "product_device_compatibility"("deviceModelId");

-- CreateIndex
CREATE INDEX "inventory_movements_productId_createdAt_idx" ON "inventory_movements"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_guestToken_key" ON "carts"("guestToken");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "product_requests_reference_key" ON "product_requests"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "product_requests_idempotencyKey_key" ON "product_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "product_requests_customerId_createdAt_idx" ON "product_requests"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "product_requests_status_createdAt_idx" ON "product_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "product_request_items_requestId_idx" ON "product_request_items"("requestId");

-- CreateIndex
CREATE INDEX "product_request_status_history_requestId_createdAt_idx" ON "product_request_status_history"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "product_request_notes_requestId_createdAt_idx" ON "product_request_notes"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "designs_slug_key" ON "designs"("slug");

-- CreateIndex
CREATE INDEX "designs_active_collection_idx" ON "designs"("active", "collection");

-- CreateIndex
CREATE UNIQUE INDEX "design_options_kind_slug_key" ON "design_options"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "customization_requests_reference_key" ON "customization_requests"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "customization_requests_idempotencyKey_key" ON "customization_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "customization_requests_customerId_createdAt_idx" ON "customization_requests"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customization_requests_status_createdAt_idx" ON "customization_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "customization_status_history_requestId_createdAt_idx" ON "customization_status_history"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "customization_notes_requestId_createdAt_idx" ON "customization_notes"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "content_items_topic_idx" ON "content_items"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "content_items_type_slug_key" ON "content_items"("type", "slug");

-- CreateIndex
CREATE INDEX "content_translations_locale_status_publishedAt_idx" ON "content_translations"("locale", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_contentItemId_locale_key" ON "content_translations"("contentItemId", "locale");

-- CreateIndex
CREATE INDEX "content_revisions_translationId_createdAt_idx" ON "content_revisions"("translationId", "createdAt");

-- CreateIndex
CREATE INDEX "content_relations_targetType_targetId_idx" ON "content_relations"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "content_relations_contentItemId_targetType_targetId_key" ON "content_relations"("contentItemId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "device_specifications_deviceModelId_key" ON "device_specifications"("deviceModelId");

-- CreateIndex
CREATE UNIQUE INDEX "device_specifications_slug_key" ON "device_specifications"("slug");

-- CreateIndex
CREATE INDEX "device_specifications_status_idx" ON "device_specifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "device_comparisons_slug_key" ON "device_comparisons"("slug");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_customizationRequestId_fkey" FOREIGN KEY ("customizationRequestId") REFERENCES "customization_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_device_compatibility" ADD CONSTRAINT "product_device_compatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_device_compatibility" ADD CONSTRAINT "product_device_compatibility_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_items" ADD CONSTRAINT "product_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "product_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_items" ADD CONSTRAINT "product_request_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_items" ADD CONSTRAINT "product_request_items_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_status_history" ADD CONSTRAINT "product_request_status_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "product_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_notes" ADD CONSTRAINT "product_request_notes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "product_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_finishOptionId_fkey" FOREIGN KEY ("finishOptionId") REFERENCES "design_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_coverageOptionId_fkey" FOREIGN KEY ("coverageOptionId") REFERENCES "design_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_status_history" ADD CONSTRAINT "customization_status_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customization_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_notes" ADD CONSTRAINT "customization_notes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customization_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "content_translations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_relations" ADD CONSTRAINT "content_relations_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_specifications" ADD CONSTRAINT "device_specifications_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_devices" ADD CONSTRAINT "comparison_devices_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "device_comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_devices" ADD CONSTRAINT "comparison_devices_specId_fkey" FOREIGN KEY ("specId") REFERENCES "device_specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Human-readable references for product order requests (TN-P-YYMM-00001) and customization requests (TN-C-YYMM-00001).
CREATE SEQUENCE IF NOT EXISTS product_request_ref_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customization_request_ref_seq START 1;
