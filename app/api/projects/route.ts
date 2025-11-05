import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  successResponse,
  errorResponse,
  validateRequestBody,
  withErrorHandling,
} from "@/lib/api-helpers";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  imageFormat: z.enum(["PNG", "JPEG", "WEBP"]).optional().default("PNG"),
  imageAspectRatio: z
    .enum(["SQUARE", "HORIZONTAL", "VERTICAL"])
    .optional()
    .default("SQUARE"),
});

// GET all projects
export const GET = withErrorHandling(async () => {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      imageFormat: true,
      imageAspectRatio: true,
      createdAt: true,
      updatedAt: true,
      totalInputTokens: true,
      totalOutputTokens: true,
      totalImagesGenerated: true,
      totalCost: true,
      _count: {
        select: {
          messages: true,
          images: true,
        },
      },
    },
  });

  return successResponse({ projects });
});

// POST create new project
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { name, imageFormat, imageAspectRatio } = await validateRequestBody(
    request,
    createProjectSchema
  );

  const project = await prisma.project.create({
    data: {
      name,
      imageFormat: imageFormat || "PNG",
      imageAspectRatio: imageAspectRatio || "SQUARE",
    },
  });

  return successResponse({ project });
});

// DELETE project
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    throw new ValidationError("Project ID is required");
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new NotFoundError("Project", id);
  }

  await prisma.project.delete({
    where: { id },
  });

  return successResponse({ success: true });
});
