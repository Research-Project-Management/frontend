import { z } from "zod";

export const pageSchema = z.object({
  _id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  pdfThumbnail: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  workspaceId: z.any().optional(),
  projectId: z.any().optional(),
  parentPage: z.string().optional(),
  mainFile: z.any().optional(),
});

export const pageFileSchema = z.object({
  _id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  pageId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const pageVersionSchema = z.object({
  _id: z.string(),
  label: z.string().optional(),
  pageId: z.string(),
  rootPageId: z.string().optional(),
  createdAt: z.string(),
  savedBy: z.object({
    name: z.string()
  }).optional(),
});

export const projectEventSchema = z.object({
  _id: z.string(),
  eventType: z.enum(["manual_save", "auto_save", "file_created", "file_deleted", "asset_uploaded", "asset_deleted"]),
  fileName: z.string().optional(),
  label: z.string().optional(),
  projectId: z.string(),
  createdAt: z.string(),
  savedBy: z.object({
    name: z.string()
  }).optional(),
});

export type Page = z.infer<typeof pageSchema>;
export type PageFile = z.infer<typeof pageFileSchema>;
export type PageVersion = z.infer<typeof pageVersionSchema>;
export type ProjectEvent = z.infer<typeof projectEventSchema>;
