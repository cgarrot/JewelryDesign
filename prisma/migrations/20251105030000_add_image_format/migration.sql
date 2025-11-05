-- CreateEnum
CREATE TYPE "ImageFormat" AS ENUM ('PNG', 'JPEG', 'WEBP');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "imageFormat" "ImageFormat" NOT NULL DEFAULT 'PNG';

