import type {
  Note,
  CreateNoteDTO,
  UpdateNoteDTO,
  ExtractNotesOptions,
} from '@/features/library/types/core.types';
import { libraryClient, resolveLibraryUrl, getBasePath, isProjectScope } from './http.client';

export type { ExtractNotesOptions, CreateNoteDTO, UpdateNoteDTO };

function getNotesUrl(spaceId?: string, suffix = ''): string {
  return resolveLibraryUrl('catalog', '/notes', spaceId, suffix);
}

function unwrapNoteResponse(
  raw: Note | { success?: boolean; data?: Note; note?: Note; literatureNote?: Note },
): Note {
  if (raw && typeof raw === 'object') {
    if ('data' in raw && raw.data) return raw.data;
    if ('note' in raw && raw.note) return raw.note;
    if ('literatureNote' in raw && raw.literatureNote) return raw.literatureNote;
  }
  return raw as Note;
}


export const NotesService = {
  list: async (spaceId?: string, itemId?: string): Promise<Note[]> => {
    const params = new URLSearchParams();
    if (itemId) params.set('itemId', itemId);
    if (isProjectScope(spaceId)) params.set('spaceId', spaceId!);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const raw = await libraryClient.get<Note[] | { success?: boolean; data?: Note[]; notes?: Note[] }>(
      `${getNotesUrl(spaceId)}${queryString}`,
    );

    if (Array.isArray(raw)) {
      return raw;
    }
    return (raw && typeof raw === 'object' ? (raw.data || raw.notes) : []) || [];
  },

  get: async (spaceId: string | undefined, id: string): Promise<Note> => {
    const raw = await libraryClient.get<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(spaceId, encodeURIComponent(id)),
    );
    return unwrapNoteResponse(raw);
  },

  create: async (spaceId: string | undefined, dto: CreateNoteDTO): Promise<Note> => {
    const raw = await libraryClient.post<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(spaceId),
      {
        ...dto,
        ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
      },
    );
    return unwrapNoteResponse(raw);
  },

  update: async (
    spaceId: string | undefined,
    id: string,
    expectedVersion: number | undefined,
    dto: UpdateNoteDTO,
  ): Promise<Note> => {
    const raw = await libraryClient.patch<Note | { success?: boolean; data?: Note; note?: Note }>(
      getNotesUrl(spaceId, encodeURIComponent(id)),
      {
        ...dto,
        expectedVersion,
      },
    );
    return unwrapNoteResponse(raw);
  },

  delete: async (
    spaceId: string | undefined,
    id: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean }> => {
    const versionQuery = expectedVersion !== undefined
      ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`
      : '';
    const raw = await libraryClient.delete<{ deleted?: boolean; data?: { deleted: boolean } }>(
      `${getNotesUrl(spaceId, encodeURIComponent(id))}${versionQuery}`,
    );

    if (raw && typeof raw === 'object' && 'deleted' in raw) {
      return { deleted: Boolean(raw.deleted) };
    }
    return raw?.data || { deleted: true };
  },

  extractFromAnnotations: async (
    spaceId: string | undefined,
    itemId: string,
    options?: ExtractNotesOptions,
  ): Promise<Partial<Note> & { totalExtracted: number; note?: Note; message?: string }> => {
    const endpoint = `${getBasePath(spaceId)}/notes/items/${encodeURIComponent(itemId)}/from-annotations`;
    const raw = await libraryClient.post<
      | Note
      | {
          success?: boolean;
          data?: Note;
          note?: Note;
          literatureNote?: Note;
          totalExtracted?: number;
          message?: string;
        }
    >(endpoint, options || {});
    const note = unwrapNoteResponse(raw);
    const rawObj = raw && typeof raw === 'object' ? (raw as { totalExtracted?: number; message?: string }) : undefined;
    const totalExtracted =
      typeof rawObj?.totalExtracted === 'number'
        ? rawObj.totalExtracted
        : note && (note as { id?: string }).id
          ? 1
          : 0;
    return {
      ...(note || {}),
      totalExtracted,
      note: note && (note as { id?: string }).id ? note : undefined,
      message: rawObj?.message,
    };
  },
};
