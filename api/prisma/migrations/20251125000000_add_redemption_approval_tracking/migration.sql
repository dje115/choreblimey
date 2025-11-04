-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

