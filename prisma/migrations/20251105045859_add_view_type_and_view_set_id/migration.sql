-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('FRONT', 'SIDE', 'TOP', 'BOTTOM');

-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN     "viewSetId" TEXT,
ADD COLUMN     "viewType" "ViewType";

-- CreateIndex
CREATE INDEX "GeneratedImage_viewSetId_idx" ON "GeneratedImage"("viewSetId");
