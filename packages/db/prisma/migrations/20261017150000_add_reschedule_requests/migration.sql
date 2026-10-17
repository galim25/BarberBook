-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'reschedule_request_pending';
ALTER TYPE "NotificationType" ADD VALUE 'reschedule_decision';

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "reschedule_requests" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "reviewed_by_user_id" TEXT,
    "new_work_day_id" TEXT NOT NULL,
    "new_starts_at" TIMESTAMP(3) NOT NULL,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reschedule_requests_appointment_id_key" ON "reschedule_requests"("appointment_id");
CREATE INDEX "reschedule_requests_requested_by_user_id_idx" ON "reschedule_requests"("requested_by_user_id");

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
