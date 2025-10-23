-- CreateEnum
CREATE TYPE "GenderTag" AS ENUM ('male', 'female', 'both', 'unisex');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgeTag" ADD VALUE 'toddler_2_4';
ALTER TYPE "AgeTag" ADD VALUE 'young_adult_16_18';

-- DropIndex
DROP INDEX "public"."RewardItem_provider_ageTag_blocked_idx";

-- AlterTable
ALTER TABLE "RewardItem" ADD COLUMN     "genderTag" "GenderTag" NOT NULL DEFAULT 'both';

-- CreateIndex
CREATE INDEX "RewardItem_provider_ageTag_genderTag_blocked_idx" ON "RewardItem"("provider", "ageTag", "genderTag", "blocked");
