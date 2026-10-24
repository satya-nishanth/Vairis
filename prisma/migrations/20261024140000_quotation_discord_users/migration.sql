-- CreateTable
CREATE TABLE "QuotationDiscordUser" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "email" TEXT,
    "discordUserId" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationDiscordUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuotationDiscordUser_handle_key" ON "QuotationDiscordUser"("handle");

-- CreateIndex
CREATE INDEX "QuotationDiscordUser_active_idx" ON "QuotationDiscordUser"("active");
