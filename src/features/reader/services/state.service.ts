/**
 * state.service.ts
 *
 * Facade delegating to readerService.state (features/reader/data/reader.service.ts)
 * 100% self-contained within features/reader with no dependencies on features/library.
 */

import { readerService } from '../data/reader.service';
import type { DocumentReadingState } from '../types/reader.types';

export type ItemStateData = DocumentReadingState;

export interface UpdateReadingStatePayload {
  readStatus?: 'unread' | 'reading' | 'completed';
  rating?: number;
  currentPage?: number;
  scrollPosition?: Record<string, unknown> | Array<unknown> | null;
}

export const StateService = {
  getState: (scopeId: string | undefined, itemId: string) =>
    readerService.state.getState(scopeId, itemId),

  updateState: (
    scopeId: string | undefined,
    itemId: string,
    data: UpdateReadingStatePayload,
  ) =>
    readerService.state.updateState(scopeId, itemId, data),

  markAsRead: (scopeId: string | undefined, itemId: string) =>
    readerService.state.markAsRead(scopeId, itemId),
};

export const ReadingService = StateService;
export default StateService;
