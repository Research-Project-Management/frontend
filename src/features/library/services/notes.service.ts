import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/lib/api";
import type { Note } from '../types/library.types';
import { noteResponseSchema, noteListResponseSchema } from '../schemas/library.schema';
import { isProjectScope } from './items.service';

export interface CreateNoteDTO {
  itemId?: string | null;
  title?: string;
  contentJson?: Record<string, unknown> | null;
  contentMd?: string;
  tags?: string[];
}

export interface UpdateNoteDTO {
  title?: string;
  contentJson?: Record<string, unknown> | null;
  contentMd?: string;
  tags?: string[];
  expectedVersion?: number;
}

function getNotesBasePath(scopeId?: string): string {
  return isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/notes`
    : `/api/v1/library/notes`;
}

export const NotesService = {
  /**
   * List notes, optionally filtered by itemId
   */
  list: async (scopeId?: string, itemId?: string): Promise<Note[]> => {
    const isProject = isProjectScope(scopeId);
    const params = new URLSearchParams();
    if (itemId) params.set('itemId', itemId);
    if (isProject) params.set('projectId', scopeId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const basePath = getNotesBasePath(scopeId);
    const raw = await apiGet<any>(`${basePath}${queryString}`);

    const parsed = noteListResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    if (Array.isArray(raw)) {
      return raw;
    }
    return raw?.data || raw?.notes || [];
  },

  /**
   * Get single note by id
   */
  get: async (scopeId: string | undefined, id: string): Promise<Note> => {
    const basePath = getNotesBasePath(scopeId);
    const raw = await apiGet<any>(
      `${basePath}/${encodeURIComponent(id)}`,
    );

    const parsed = noteResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw?.data || raw?.note || raw;
  },

  /**
   * Create a new canonical Note
   */
  create: async (scopeId: string | undefined, dto: CreateNoteDTO): Promise<Note> => {
    const isProject = isProjectScope(scopeId);
    const basePath = getNotesBasePath(scopeId);
    const raw = await apiPost<any>(
      basePath,
      {
        ...dto,
        ...(isProject ? { projectId: scopeId } : {}),
      },
    );

    const parsed = noteResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw?.data || raw?.note || raw;
  },

  /**
   * Update an existing Note with optimistic locking
   */
  update: async (
    scopeId: string | undefined,
    id: string,
    expectedVersion: number | undefined,
    dto: UpdateNoteDTO,
  ): Promise<Note> => {
    const basePath = getNotesBasePath(scopeId);
    const raw = await apiPatch<any>(
      `${basePath}/${encodeURIComponent(id)}`,
      {
        ...dto,
        expectedVersion,
      },
    );

    const parsed = noteResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw?.data || raw?.note || raw;
  },

  /**
   * Soft-delete a Note
   */
  delete: async (
    scopeId: string | undefined,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const basePath = getNotesBasePath(scopeId);
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    const raw = await apiDelete<any>(
      `${basePath}/${encodeURIComponent(id)}${versionQuery}`,
    );

    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },
};

// Aliases
export const getNotes = NotesService.list;
export const getNote = NotesService.get;
export const createNote = NotesService.create;
export const updateNote = NotesService.update;
export const deleteNote = NotesService.delete;
export const NoteService = NotesService;
