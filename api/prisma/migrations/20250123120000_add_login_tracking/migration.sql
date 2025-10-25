-- Add login tracking fields to Family table
ALTER TABLE "Family" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "Family" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- Add index for efficient querying
CREATE INDEX "Family_lastLoginAt_idx" ON "Family"("lastLoginAt");
CREATE INDEX "Family_suspendedAt_idx" ON "Family"("suspendedAt");
