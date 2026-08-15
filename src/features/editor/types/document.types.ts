/**
 * document.types.ts — Pure type declarations for pages, versions, events and comments.
 * These are the "full" document types used by the Editor feature.
 * The all-pages module may re-use the Page type but should NOT own version/event/comment types.
 */

// ── Page ────────────────────────────────────────────────────────────────────────

export type Page = {
  _id: string;
  title: string;
  content: any; // JSON structure for editor
  status: "draft" | "published" | "archived";
  projectId:
    | string
    | { _id: string; name: string; workspaceId?: string | { _id: string; url: string } };
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
  views: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
  /** Null = top-level page-project. Populated = this is a file inside a page-project. */
  parentPage?: string | null;
  /** The child page designated as the main entry point (for compilation & thumbnail). Can be a full Page object when populated. */
  mainFile?: string | Page | null;
  /** Base64 JPEG data URL of the first page of the last successful PDF build. */
  pdfThumbnail?: string | null;
};

// ── Page File (sub-file inside a page-project) ─────────────────────────────────

export type PageFile = {
  _id: string;
  title: string;
  content?: string;
  pageId: string;
  createdAt?: string;
  updatedAt?: string;
};

// ── Version history ─────────────────────────────────────────────────────────────

export type PageVersion = {
  _id: string;
  title: string;
  label: string;
  fileName: string;
  savedBy: { _id: string; name: string; avatar?: string };
  createdAt: string;
};

export type PageVersionWithContent = PageVersion & { content: string };

// ── Project events (history timeline) ───────────────────────────────────────────

export type PageEvent = {
  _id: string;
  eventType:
    | "manual_save"
    | "auto_save"
    | "file_created"
    | "file_deleted"
    | "asset_uploaded"
    | "asset_deleted";
  title: string;
  label: string;
  fileName: string;
  savedBy: { _id: string; name: string; avatar?: string };
  createdAt: string;
  /** The specific page that was modified (for content events). */
  page: string;
};

/** Alias kept for backward-compat with services that use ProjectEvent. */
export type ProjectEvent = PageEvent;

// ── Comments & Replies ──────────────────────────────────────────────────────────

export type CommentReply = {
  _id: string;
  author: { _id: string; name: string; avatar?: string };
  content: string;
  createdAt: string;
};

export type PageComment = {
  _id: string;
  page: string;
  projectPageId: string;
  author: { _id: string; name: string; avatar?: string };
  content: string;
  line: number | null;
  lineEnd?: number | null;
  status: "open" | "resolved";
  replies: CommentReply[];
  createdAt: string;
  updatedAt: string;
};
