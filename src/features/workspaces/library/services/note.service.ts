import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type { Note } from '../types/library.types';
import { noteResponseSchema, noteListResponseSchema } from '../schemas/library-api.schema';

export interface CreateNoteDTO {
  itemId?: string | null;
  title?: string;
  contentJson?: any;
  contentMd?: string;
  tags?: string[];
}

export interface UpdateNoteDTO {
  title?: string;
  contentJson?: any;
  contentMd?: string;
  tags?: string[];
  expectedVersion?: number;
}

export const NoteService = {
  /**
   * List notes for a workspace, optionally filtered by itemId
   */
  list: async (workspaceId: string, itemId?: string): Promise<Note[]> => {
    const query = itemId ? `?itemId=${encodeURIComponent(itemId)}` : '';
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes${query}`,
    );

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
  get: async (workspaceId: string, id: string): Promise<Note> => {
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}`,
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
  create: async (workspaceId: string, dto: CreateNoteDTO): Promise<Note> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes`,
      dto,
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
    workspaceId: string,
    id: string,
    expectedVersion: number | undefined,
    dto: UpdateNoteDTO,
  ): Promise<Note> => {
    const raw = await apiPatch<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}`,
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
    workspaceId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    const raw = await apiDelete<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}${versionQuery}`,
    );

    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },
};

// Aliases
export const getNotes = NoteService.list;
export const getNote = NoteService.get;
export const createNote = NoteService.create;
export const updateNote = NoteService.update;
export const deleteNote = NoteService.delete;
