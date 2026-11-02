-- Move sign-in to Supabase Auth: app users link to auth.users through "authUserId"; Better Auth's tables go.
-- Two-factor factors now live in Supabase, so owners enrol again (the mirror flag starts false).

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "two_factors" DROP CONSTRAINT "two_factors_userId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authUserId" TEXT,
ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "lastSignInAt" TIMESTAMP(3),
ADD COLUMN     "sessionsRevokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "impersonatorId" TEXT;

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "verifications";

-- DropTable
DROP TABLE "two_factors";

-- CreateTable
CREATE TABLE "test_otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_otps_createdAt_idx" ON "test_otps"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_authUserId_key" ON "users"("authUserId");


-- Better Auth two-factor secrets are not portable to Supabase MFA.
UPDATE "users" SET "twoFactorEnabled" = false;
