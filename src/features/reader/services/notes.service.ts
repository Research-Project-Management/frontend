import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/lib/api";
import type { ReaderNote, CreateNoteDto, UpdateNoteDto } from '../types/reader.types';

export type CreateNoteDTO = CreateNoteDto;
export type UpdateNoteDTO = UpdateNoteDto & { expectedVersion?: number };

/**
 * NotesService corresponding to backend NotesController (/api/v1/library/notes)
 */
export const NotesService = {
  /**
   * List notes, optionally filtered by itemId
   */
  list: async (_scopeId?: string, itemId?: string): Promise<ReaderNote[]> => {
    const url = itemId
      ? `/api/v1/library/notes/items/${encodeURIComponent(itemId)}`
      : `/api/v1/library/notes`;
    const raw = await apiGet<any>(url);
    if (Array.isArray(raw)) return raw;
    return raw?.data || raw?.notes || [];
  },

  /**
   * List notes specifically for an item
   */
  listByItem: async (_scopeId: string | undefined, itemId: string): Promise<ReaderNote[]> => {
    const raw = await apiGet<any>(
      `/api/v1/library/notes/items/${encodeURIComponent(itemId)}`,
    );
    if (Array.isArray(raw)) return raw;
    return raw?.data || raw?.notes || [];
  },

  /**
   * Get single note by id
   */
  get: async (_scopeId: string | undefined, id: string): Promise<ReaderNote> => {
    const raw = await apiGet<any>(
      `/api/v1/library/notes/${encodeURIComponent(id)}`,
    );
    return raw?.data || raw?.note || raw;
  },

  /**
   * Create a new Note
   */
  create: async (_scopeId: string | undefined, dto: CreateNoteDTO): Promise<ReaderNote> => {
    const raw = await apiPost<any>(
      `/api/v1/library/notes`,
      dto,
    );
    return raw?.data || raw?.note || raw;
  },

  /**
   * Update an existing Note
   */
  update: async (
    _scopeId: string | undefined,
    id: string,
    version: number,
    dto: UpdateNoteDTO,
  ): Promise<ReaderNote> => {
    const raw = await apiPatch<any>(
      `/api/v1/library/notes/${encodeURIComponent(id)}`,
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
    _scopeId: string | undefined,
    id: string,
    version?: number,
  ): Promise<{ deleted: boolean }> => {
    const query = version !== undefined ? `?expectedVersion=${encodeURIComponent(String(version))}` : '';
    const raw = await apiDelete<any>(
      `/api/v1/library/notes/${encodeURIComponent(id)}${query}`,
    );
    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },
};
