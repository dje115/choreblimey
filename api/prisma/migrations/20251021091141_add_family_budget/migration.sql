-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('weekly', 'monthly');

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "budgetPeriod" "BudgetPeriod" DEFAULT 'weekly',
ADD COLUMN     "budgetStartDate" TIMESTAMP(3),
ADD COLUMN     "maxBudgetPence" INTEGER;
