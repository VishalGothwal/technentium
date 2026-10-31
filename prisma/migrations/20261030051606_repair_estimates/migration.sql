-- CreateTable
CREATE TABLE "repair_estimates" (
    "id" TEXT NOT NULL,
    "issueTypeId" TEXT NOT NULL,
    "modelId" TEXT,
    "minPaise" INTEGER NOT NULL,
    "maxPaise" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repair_estimates_modelId_idx" ON "repair_estimates"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "repair_estimates_issueTypeId_modelId_key" ON "repair_estimates"("issueTypeId", "modelId");

-- AddForeignKey
ALTER TABLE "repair_estimates" ADD CONSTRAINT "repair_estimates_issueTypeId_fkey" FOREIGN KEY ("issueTypeId") REFERENCES "repair_issue_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_estimates" ADD CONSTRAINT "repair_estimates_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
