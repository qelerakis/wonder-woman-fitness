-- AlterTable: Add audit trail fields to private_sessions
ALTER TABLE "private_sessions" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "private_sessions" ADD COLUMN "paidMarkedById" TEXT;

-- AddForeignKey: paidMarkedBy -> users (SetNull on delete)
ALTER TABLE "private_sessions" ADD CONSTRAINT "private_sessions_paidMarkedById_fkey" FOREIGN KEY ("paidMarkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey: drop old createdBy foreign key (no cascade)
ALTER TABLE "private_sessions" DROP CONSTRAINT "private_sessions_createdById_fkey";

-- AddForeignKey: createdBy -> users (Cascade on delete)
ALTER TABLE "private_sessions" ADD CONSTRAINT "private_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
