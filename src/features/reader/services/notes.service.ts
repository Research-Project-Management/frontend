/**
 * notes.service.ts
 *
 * Facade delegating to readerService.notes (features/reader/data/reader.service.ts)
 * 100% self-contained within features/reader with no dependencies on features/library.
 */

import { readerService } from '../data/reader.service';
import type { ReaderNote, CreateNoteDto, UpdateNoteDto } from '../types/reader.types';

export type CreateNoteDTO = CreateNoteDto;
export type UpdateNoteDTO = UpdateNoteDto & { expectedVersion?: number };

export const NotesService = {
  list: async (scopeId?: string, itemId?: string): Promise<ReaderNote[]> => {
    return readerService.notes.list(scopeId, itemId);
  },

  listByItem: async (scopeId: string | undefined, itemId: string): Promise<ReaderNote[]> => {
    return readerService.notes.list(scopeId, itemId);
  },

  get: async (scopeId: string | undefined, id: string): Promise<ReaderNote> => {
    return readerService.notes.get(scopeId, id);
  },

  create: async (scopeId: string | undefined, dto: CreateNoteDTO): Promise<ReaderNote> => {
    return readerService.notes.create(scopeId, dto);
  },

  update: async (
    scopeId: string | undefined,
    id: string,
    version: number,
    dto: UpdateNoteDTO,
  ): Promise<ReaderNote> => {
    return readerService.notes.update(scopeId, id, version, dto);
  },

  delete: async (
    scopeId: string | undefined,
    id: string,
    version?: number,
  ): Promise<{ deleted: boolean }> => {
    return readerService.notes.delete(scopeId, id, version);
  },
};

export default NotesService;
