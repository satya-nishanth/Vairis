-- Catalogue reel: guest auth + feedback (safe to run on prod — only adds new tables)

CREATE TABLE "GuestUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogueProgress" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "lastFrameIndex" INTEGER NOT NULL DEFAULT -1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogueProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogueReaction" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogueReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogueComment" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestUser_username_key" ON "GuestUser"("username");
CREATE UNIQUE INDEX "GuestUser_email_key" ON "GuestUser"("email");
CREATE UNIQUE INDEX "GuestUser_phone_key" ON "GuestUser"("phone");
CREATE UNIQUE INDEX "CatalogueProgress_guestUserId_key" ON "CatalogueProgress"("guestUserId");
CREATE UNIQUE INDEX "CatalogueReaction_guestUserId_productId_key" ON "CatalogueReaction"("guestUserId", "productId");

ALTER TABLE "CatalogueProgress" ADD CONSTRAINT "CatalogueProgress_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogueReaction" ADD CONSTRAINT "CatalogueReaction_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogueComment" ADD CONSTRAINT "CatalogueComment_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
