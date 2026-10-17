-- CreateTable
CREATE TABLE "waitlist_date_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "work_day_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_date_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_date_entries_work_day_id_idx" ON "waitlist_date_entries"("work_day_id");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_date_entries_user_id_work_day_id_period_key" ON "waitlist_date_entries"("user_id", "work_day_id", "period");

-- AddForeignKey
ALTER TABLE "waitlist_date_entries" ADD CONSTRAINT "waitlist_date_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_date_entries" ADD CONSTRAINT "waitlist_date_entries_work_day_id_fkey" FOREIGN KEY ("work_day_id") REFERENCES "work_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
