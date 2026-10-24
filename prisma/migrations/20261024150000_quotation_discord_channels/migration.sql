-- CreateTable
CREATE TABLE "QuotationDiscordSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "threadChannelId" TEXT,
    "pingChannelId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationDiscordSettings_pkey" PRIMARY KEY ("id")
);
