-- Run in Supabase Dashboard → SQL Editor (project ohnydotpayefvaurtiyy)
-- Safe to re-run — uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS "GuestUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogueProgress" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "lastFrameIndex" INTEGER NOT NULL DEFAULT -1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogueReaction" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogueComment" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuestUser_username_key" ON "GuestUser"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "GuestUser_email_key" ON "GuestUser"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "GuestUser_phone_key" ON "GuestUser"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogueProgress_guestUserId_key" ON "CatalogueProgress"("guestUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogueReaction_guestUserId_productId_key" ON "CatalogueReaction"("guestUserId", "productId");

DO $$ BEGIN
  ALTER TABLE "CatalogueProgress" ADD CONSTRAINT "CatalogueProgress_guestUserId_fkey"
    FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogueReaction" ADD CONSTRAINT "CatalogueReaction_guestUserId_fkey"
    FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogueComment" ADD CONSTRAINT "CatalogueComment_guestUserId_fkey"
    FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verify
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('GuestUser','CatalogueProgress','CatalogueReaction','CatalogueComment');
