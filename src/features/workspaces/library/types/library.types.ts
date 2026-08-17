import { z } from "zod";
import {
  collectionSchema,
  paperSchema,
  paperAttachmentSchema,
  primaryFileSchema,
  projectPaperRefSchema,
  projectCollectionSchema,
  userSchema,
  noteSchema
} from "../schemas/library.schema";
import type { ReferenceData } from "./reference.types";

// ── Derived Schema Types ──────────────────────────────────────────────────────

export type User = z.infer<typeof userSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type PaperAttachment = z.infer<typeof paperAttachmentSchema>;
export type PrimaryFile = z.infer<typeof primaryFileSchema>;
export type Paper = z.infer<typeof paperSchema>;
export type ProjectPaperRef = z.infer<typeof projectPaperRefSchema>;
export type ProjectCollection = z.infer<typeof projectCollectionSchema>;

export type { ReferenceData };

// ── DTOs & Mutation Inputs ────────────────────────────────────────────────────

export interface CollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
}

export type CreateCollectionDTO = CollectionInput;

export interface UpdateCollectionDTO {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
}

export interface IngestPaperDTO {
  source?: "upload" | "storage" | "identifier";
  fileId?: string | null;
  collectionId?: string | null;
  title?: string;
  filename?: string;
  fileUrl?: string;
  size?: number;
  mimeType?: string;
  authors?: string[];
  year?: number | null;
  doi?: string;
  citationKey?: string;
}

export interface PaperQueryParams {
  collectionId?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export type PaperInput = Partial<Paper>;
export type CreatePaperDTO = Partial<Paper> & { collectionId?: string | null };
export type UpdatePaperDTO = Partial<Paper>;

export type Result<T> = { success: true; data: T } | { success: false; error: string };
