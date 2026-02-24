-- DropForeignKey
ALTER TABLE "financial_transactions" DROP CONSTRAINT IF EXISTS "financial_transactions_branchId_fkey";
ALTER TABLE "financial_transactions" DROP CONSTRAINT IF EXISTS "financial_transactions_categoryId_fkey";
ALTER TABLE "financial_transactions" DROP CONSTRAINT IF EXISTS "financial_transactions_subcategoryId_fkey";
ALTER TABLE "financial_transactions" DROP CONSTRAINT IF EXISTS "financial_transactions_bankAccountId_fkey";
ALTER TABLE "financial_transactions" DROP CONSTRAINT IF EXISTS "financial_transactions_paymentMethodConfigId_fkey";
ALTER TABLE "financial_categories" DROP CONSTRAINT IF EXISTS "financial_categories_parentId_fkey";

-- DropTable
DROP TABLE IF EXISTS "financial_transactions";
DROP TABLE IF EXISTS "financial_categories";

-- DropEnum
DROP TYPE IF EXISTS "TransactionType";
DROP TYPE IF EXISTS "TransactionStatus";
