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
    const raw = await apiGet<{ success: boolean; data: Note[] }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes${query}`,
    );

    const parsed = noteListResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw?.data || [];
  },

  /**
   * Get single note by id
   */
  get: async (workspaceId: string, id: string): Promise<Note> => {
    const raw = await apiGet<{ success: boolean; data: Note }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}`,
    );

    const parsed = noteResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw.data;
  },

  /**
   * Create a new canonical Note
   */
  create: async (workspaceId: string, dto: CreateNoteDTO): Promise<Note> => {
    const raw = await apiPost<{ success: boolean; data: Note }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes`,
      dto,
    );

    const parsed = noteResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw.data;
  },

  /**
   * Update an existing Note with optimistic locking
   */
  update: async (
    workspaceId: string,
    id: string,
    expectedVersion: number,
    dto: UpdateNoteDTO,
  ): Promise<Note> => {
    const raw = await apiPatch<{ success: boolean; data: Note }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}`,
      {
        ...dto,
        expectedVersion,
      },
      {
        headers: {
          'If-Match': String(expectedVersion),
        },
      },
    );

    const parsed = noteResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success) {
      return parsed.data.data;
    }
    return raw.data;
  },

  /**
   * Soft-delete a Note
   */
  delete: async (
    workspaceId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const raw = await apiDelete<{ success: boolean; data: { deleted: boolean } }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}`,
      {
        headers: expectedVersion ? { 'If-Match': String(expectedVersion) } : undefined,
      },
    );

    return raw?.data ?? { deleted: true };
  },
};
