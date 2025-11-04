-- CreateEnum
CREATE TYPE "GiftType" AS ENUM ('amazon_product', 'activity', 'custom');

-- CreateTable
CREATE TABLE "GiftTemplate" (
    "id" TEXT NOT NULL,
    "type" "GiftType" NOT NULL,
    "provider" TEXT,
    "amazonAsin" TEXT,
    "affiliateUrl" TEXT,
    "affiliateTag" TEXT,
    "sitestripeUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "suggestedAgeRanges" JSONB,
    "suggestedGender" TEXT,
    "pricePence" INTEGER,
    "suggestedStars" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyGift" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "giftTemplateId" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "type" "GiftType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "provider" TEXT,
    "amazonAsin" TEXT,
    "affiliateUrl" TEXT,
    "affiliateTag" TEXT,
    "sitestripeUrl" TEXT,
    "category" TEXT,
    "starsRequired" INTEGER NOT NULL,
    "ageTag" TEXT,
    "genderTag" TEXT,
    "availableForAll" BOOLEAN NOT NULL DEFAULT true,
    "availableForChildIds" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyGift_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN "familyGiftId" TEXT;

-- CreateIndex
CREATE INDEX "GiftTemplate_type_active_idx" ON "GiftTemplate"("type", "active");

-- CreateIndex
CREATE INDEX "GiftTemplate_category_active_idx" ON "GiftTemplate"("category", "active");

-- CreateIndex
CREATE INDEX "GiftTemplate_featured_active_idx" ON "GiftTemplate"("featured", "active");

-- CreateIndex
CREATE INDEX "FamilyGift_familyId_active_idx" ON "FamilyGift"("familyId", "active");

-- CreateIndex
CREATE INDEX "FamilyGift_familyId_type_idx" ON "FamilyGift"("familyId", "type");

-- CreateIndex
CREATE INDEX "FamilyGift_giftTemplateId_idx" ON "FamilyGift"("giftTemplateId");

-- CreateIndex
CREATE INDEX "Redemption_familyGiftId_idx" ON "Redemption"("familyGiftId");

-- AddForeignKey
ALTER TABLE "FamilyGift" ADD CONSTRAINT "FamilyGift_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGift" ADD CONSTRAINT "FamilyGift_giftTemplateId_fkey" FOREIGN KEY ("giftTemplateId") REFERENCES "GiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_familyGiftId_fkey" FOREIGN KEY ("familyGiftId") REFERENCES "FamilyGift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

