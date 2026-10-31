-- AlterTable
ALTER TABLE "device_models" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "frame" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "typeId" TEXT;

-- CreateTable
CREATE TABLE "product_types" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "descriptionEn" TEXT,
    "descriptionHi" TEXT,
    "highlights" JSONB NOT NULL DEFAULT '{}',
    "imageMediaId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_types_categoryId_slug_key" ON "product_types"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "products_categoryId_typeId_status_idx" ON "products"("categoryId", "typeId", "status");

-- AddForeignKey
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
