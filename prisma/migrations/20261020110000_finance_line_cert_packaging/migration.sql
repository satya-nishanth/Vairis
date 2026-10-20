-- AlterEnum: fixed fees + combined misc + discount on order sheets
ALTER TYPE "FinanceLineKind" ADD VALUE IF NOT EXISTS 'CERTIFICATION';
ALTER TYPE "FinanceLineKind" ADD VALUE IF NOT EXISTS 'PACKAGING';
ALTER TYPE "FinanceLineKind" ADD VALUE IF NOT EXISTS 'MISC';
ALTER TYPE "FinanceLineKind" ADD VALUE IF NOT EXISTS 'DISCOUNT';
