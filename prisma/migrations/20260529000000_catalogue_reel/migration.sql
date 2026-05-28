-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('like', 'dislike');

-- CreateTable
CREATE TABLE "GuestUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueProgress" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "lastFrameIndex" INTEGER NOT NULL DEFAULT -1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogueProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueReaction" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reaction" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogueReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueComment" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestUser_username_key" ON "GuestUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "GuestUser_email_key" ON "GuestUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GuestUser_phone_key" ON "GuestUser"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueProgress_guestUserId_key" ON "CatalogueProgress"("guestUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueReaction_guestUserId_productId_key" ON "CatalogueReaction"("guestUserId", "productId");

-- AddForeignKey
ALTER TABLE "CatalogueProgress" ADD CONSTRAINT "CatalogueProgress_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueReaction" ADD CONSTRAINT "CatalogueReaction_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueComment" ADD CONSTRAINT "CatalogueComment_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
