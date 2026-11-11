-- AlterEnum
ALTER TYPE "MediaPurpose" ADD VALUE 'DEVICE_MODEL_3D';

-- AlterTable
ALTER TABLE "device_models" ADD COLUMN     "model3dId" TEXT;

-- AlterTable
ALTER TABLE "designs" ADD COLUMN     "hiddenSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "device_3d_models" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frame" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "fileId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_3d_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_3d_models_slug_key" ON "device_3d_models"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "device_3d_models_fileId_key" ON "device_3d_models"("fileId");

-- CreateIndex
CREATE INDEX "device_models_model3dId_idx" ON "device_models"("model3dId");

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_model3dId_fkey" FOREIGN KEY ("model3dId") REFERENCES "device_3d_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_3d_models" ADD CONSTRAINT "device_3d_models_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Same lock-down as 20261102090100_lock_public_schema: no Data API access to the new table.
ALTER TABLE "device_3d_models" ENABLE ROW LEVEL SECURITY;
