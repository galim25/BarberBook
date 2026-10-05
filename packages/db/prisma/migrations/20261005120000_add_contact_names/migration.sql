-- CreateEnum
CREATE TYPE "ContactNameSource" AS ENUM ('import', 'picker', 'manual');

-- CreateTable
CREATE TABLE "contact_names" (
    "phone_number" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "source" "ContactNameSource" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_names_pkey" PRIMARY KEY ("phone_number")
);
