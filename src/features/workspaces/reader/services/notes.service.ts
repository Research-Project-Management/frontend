import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/lib/api";
import type { ReaderNote, CreateNoteDto, UpdateNoteDto } from '../types/reader.types';

export type CreateNoteDTO = CreateNoteDto;
export type UpdateNoteDTO = UpdateNoteDto & { expectedVersion?: number };

/**
 * NotesService corresponding to backend NotesService (backend/src/modules/library/notes/notes.service.ts)
 */
export const NotesService = {
  /**
   * List notes for a workspace, optionally filtered by itemId
   */
  list: async (workspaceId: string, itemId?: string): Promise<ReaderNote[]> => {
    const query = itemId ? `?itemId=${encodeURIComponent(itemId)}` : '';
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes${query}`,
    );
    if (Array.isArray(raw)) return raw;
    return raw?.data || raw?.notes || [];
  },

  /**
   * Get single note by id
   */
  get: async (workspaceId: string, id: string): Promise<ReaderNote> => {
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}`,
    );
    return raw?.data || raw?.note || raw;
  },

  /**
   * Create a new Note
   */
  create: async (workspaceId: string, dto: CreateNoteDTO): Promise<ReaderNote> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes`,
      dto,
    );
    return raw?.data || raw?.note || raw;
  },

  /**
   * Update an existing Note
   */
  update: async (
    workspaceId: string,
    id: string,
    version: number,
    dto: UpdateNoteDTO,
  ): Promise<ReaderNote> => {
    const raw = await apiPatch<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}`,
      {
        ...dto,
        expectedVersion: version,
      },
    );
    return raw?.data || raw?.note || raw;
  },

  /**
   * Delete a note
   */
  delete: async (
    workspaceId: string,
    id: string,
    version?: number,
  ): Promise<{ deleted: boolean }> => {
    const query = version !== undefined ? `?expectedVersion=${encodeURIComponent(String(version))}` : '';
    const raw = await apiDelete<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/notes/${encodeURIComponent(id)}${query}`,
    );
    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },
};
