import type { PageSchema, CreatePageSchema } from '../schemas/page.schema';

// ── Domain & View-Model Types (Inferred from Schemas) ────────────────────────

export type Page = PageSchema;
export type CreatePageInput = CreatePageSchema;

export type PagesViewMode = 'grid' | 'list';

export type GetPagesParams = {
  status?: string;
  search?: string;
};

export type CreatePageResponse = {
  page: Page;
  mainFile?: { id: string; [key: string]: unknown } | string | null;
  rootPageId: string;
  mainFileId: string | null;
};
