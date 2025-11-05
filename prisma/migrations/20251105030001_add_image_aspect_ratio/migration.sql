-- CreateEnum
CREATE TYPE "ImageAspectRatio" AS ENUM ('SQUARE', 'HORIZONTAL', 'VERTICAL');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "imageAspectRatio" "ImageAspectRatio" NOT NULL DEFAULT 'SQUARE';

