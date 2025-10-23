/*
  Warnings:

  - The values [photo] on the enum `ProofType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `costPaid` to the `Redemption` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RewardProvider" AS ENUM ('amazon', 'ebay', 'argos', 'ticketmaster', 'custom');

-- CreateEnum
CREATE TYPE "AgeTag" AS ENUM ('kid_5_8', 'tween_9_11', 'teen_12_15', 'all_ages');

-- AlterEnum
BEGIN;
CREATE TYPE "ProofType_new" AS ENUM ('none', 'note');
ALTER TABLE "public"."Chore" ALTER COLUMN "proof" DROP DEFAULT;
ALTER TABLE "Chore" ALTER COLUMN "proof" TYPE "ProofType_new" USING ("proof"::text::"ProofType_new");
ALTER TYPE "ProofType" RENAME TO "ProofType_old";
ALTER TYPE "ProofType_new" RENAME TO "ProofType";
DROP TYPE "public"."ProofType_old";
ALTER TABLE "Chore" ALTER COLUMN "proof" SET DEFAULT 'none';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Redemption" DROP CONSTRAINT "Redemption_rewardId_fkey";

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "birthMonth" INTEGER,
ADD COLUMN     "birthYear" INTEGER,
ADD COLUMN     "interestsJson" JSONB,
ADD COLUMN     "theme" TEXT DEFAULT 'superhero';

-- AlterTable
ALTER TABLE "Completion" ADD COLUMN     "bidAmountPence" INTEGER;

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "showLifetimeEarnings" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "affiliateRewardId" TEXT,
ADD COLUMN     "costPaid" INTEGER NOT NULL,
ALTER COLUMN "rewardId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "paidBy" TEXT,
    "method" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardSource" (
    "id" TEXT NOT NULL,
    "provider" "RewardProvider" NOT NULL,
    "affiliateTag" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardItem" (
    "id" TEXT NOT NULL,
    "provider" "RewardProvider" NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "affiliateUrl" TEXT NOT NULL,
    "pricePence" INTEGER,
    "priceUpdatedAt" TIMESTAMP(3),
    "ageTag" "AgeTag" NOT NULL DEFAULT 'all_ages',
    "category" TEXT,
    "interestTags" JSONB,
    "starsRequired" INTEGER,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClick" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT,
    "userId" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "RewardClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPurchase" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "clickId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountPence" INTEGER,
    "commissionPence" INTEGER,
    "providerOrderId" TEXT,
    "status" TEXT,

    CONSTRAINT "RewardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentRewardPreferences" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "maxRewardPence" INTEGER,
    "allowedCategories" JSONB,
    "blockedCategories" JSONB,
    "curatedOnlyMode" BOOLEAN NOT NULL DEFAULT false,
    "affiliateOptIn" BOOLEAN NOT NULL DEFAULT true,
    "birthdayBonusEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pinnedRewardIds" JSONB,
    "blockedRewardIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentRewardPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorCode" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payout_familyId_childId_createdAt_idx" ON "Payout"("familyId", "childId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardSource_provider_enabled_idx" ON "RewardSource"("provider", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "RewardSource_provider_region_key" ON "RewardSource"("provider", "region");

-- CreateIndex
CREATE INDEX "RewardItem_provider_ageTag_blocked_idx" ON "RewardItem"("provider", "ageTag", "blocked");

-- CreateIndex
CREATE INDEX "RewardItem_featured_blocked_idx" ON "RewardItem"("featured", "blocked");

-- CreateIndex
CREATE INDEX "RewardItem_popularityScore_idx" ON "RewardItem"("popularityScore");

-- CreateIndex
CREATE INDEX "RewardItem_priceUpdatedAt_idx" ON "RewardItem"("priceUpdatedAt");

-- CreateIndex
CREATE INDEX "RewardClick_rewardId_clickedAt_idx" ON "RewardClick"("rewardId", "clickedAt");

-- CreateIndex
CREATE INDEX "RewardClick_familyId_clickedAt_idx" ON "RewardClick"("familyId", "clickedAt");

-- CreateIndex
CREATE INDEX "RewardPurchase_rewardId_purchasedAt_idx" ON "RewardPurchase"("rewardId", "purchasedAt");

-- CreateIndex
CREATE INDEX "RewardPurchase_familyId_purchasedAt_idx" ON "RewardPurchase"("familyId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentRewardPreferences_familyId_key" ON "ParentRewardPreferences"("familyId");

-- CreateIndex
CREATE INDEX "ParentRewardPreferences_familyId_idx" ON "ParentRewardPreferences"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "TwoFactorCode_adminId_expiresAt_idx" ON "TwoFactorCode"("adminId", "expiresAt");

-- CreateIndex
CREATE INDEX "Redemption_familyId_status_idx" ON "Redemption"("familyId", "status");

-- CreateIndex
CREATE INDEX "Redemption_childId_createdAt_idx" ON "Redemption"("childId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_affiliateRewardId_fkey" FOREIGN KEY ("affiliateRewardId") REFERENCES "RewardItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClick" ADD CONSTRAINT "RewardClick_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPurchase" ADD CONSTRAINT "RewardPurchase_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorCode" ADD CONSTRAINT "TwoFactorCode_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
