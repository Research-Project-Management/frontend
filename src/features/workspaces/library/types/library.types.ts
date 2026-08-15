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
} from "../schemas/library.schemas";

// ── Library types ─────────────────────────────────────────────────────────────

export type User = z.infer<typeof userSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type PaperAttachment = z.infer<typeof paperAttachmentSchema>;
export type PrimaryFile = z.infer<typeof primaryFileSchema>;
export type Paper = z.infer<typeof paperSchema>;
export type ProjectPaperRef = z.infer<typeof projectPaperRefSchema>;
export type ProjectCollection = z.infer<typeof projectCollectionSchema>;

export type Result<T> = { success: true; data: T } | { success: false; error: string };
