import { z } from 'zod';

// ── Reader Annotations & Highlights ──────────────────────────────────────────

export const annotationRectSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  width: z.number(),
  height: z.number(),
});

export const readerAnnotationSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  pageNumber: z.number().int().positive(),
  color: z.enum(['yellow', 'green', 'blue', 'pink', 'purple', 'red']).default('yellow'),
  type: z.enum(['highlight', 'underline', 'strike', 'note', 'area']),
  text: z.string().optional(),
  comment: z.string().optional(),
  rects: z.array(annotationRectSchema).optional(),
  boundingRect: annotationRectSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

// ── Reader Viewport & Settings ───────────────────────────────────────────────

export const readerPanelSchema = z.enum(['ai', 'details', 'notes']);
export const readerNavPanelSchema = z.enum(['outline', 'thumbnails']);

export const readerSettingsSchema = z.object({
  activePanel: readerPanelSchema.nullable().default(null),
  panelWidth: z.number().min(280).max(640).default(400),
  zoomLevel: z.number().min(0.25).max(4.0).default(1.0),
  fitMode: z.enum(['fit-width', 'fit-page', 'auto', 'custom']).default('auto'),
  viewMode: z.enum(['single', 'continuous', 'spread']).default('continuous'),
  rotation: z.enum(['0', '90', '180', '270']).default('0'),
  sidebarOpen: z.boolean().default(true),
});

// ── Reader Selection Context ──────────────────────────────────────────────────

export const selectionContextSchema = z.object({
  text: z.string(),
  pageNumber: z.number().int().positive(),
  paperId: z.string(),
  paperTitle: z.string().optional(),
});
