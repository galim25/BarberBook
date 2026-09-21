-- CreateTable
CREATE TABLE "login_codes" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_codes_phone_number_created_at_idx" ON "login_codes"("phone_number", "created_at");

-- CreateIndex
CREATE INDEX "login_codes_expires_at_idx" ON "login_codes"("expires_at");
