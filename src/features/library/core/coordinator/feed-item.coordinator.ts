import { toast } from 'sonner';
import {
  executeSaveFeedEntryToLibrary,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser.domain';
import type { Collection } from '@/features/library/domain/types/library.types';

export interface SaveFeedEntryCoordinatorOptions<
  TCreatePayload extends Record<string, unknown> = Record<string, unknown>,
> {
  entry: ParsedFeedEntry;
  scopeId: string;
  targetCollectionId?: string;
  createItem: (payload: TCreatePayload) => Promise<unknown>;
  ingestItem?: Parameters<typeof executeSaveFeedEntryToLibrary>[0]['ingestItem'];
  collections?: readonly Collection[];
  markEntryAsRead: (entryId: string) => void;
  setEntrySaving: (entryId: string, isSaving: boolean) => void;
  markEntrySaved: (entryId: string) => void;
}

/**
 * Shared coordinator workflow for saving an RSS/Atom feed entry into the user's or project's library.
 * Centralizes read marking, saving state tracking, collection toast notifications, and error handling.
 */
export async function executeSaveFeedEntryWithFeedback<
  TCreatePayload extends Record<string, unknown> = Record<string, unknown>,
>({
  entry,
  scopeId,
  targetCollectionId,
  createItem,
  ingestItem,
  collections,
  markEntryAsRead,
  setEntrySaving,
  markEntrySaved,
}: SaveFeedEntryCoordinatorOptions<TCreatePayload>): Promise<void> {
  markEntryAsRead(entry.id);
  setEntrySaving(entry.id, true);
  try {
    await executeSaveFeedEntryToLibrary({
      entry,
      scopeId,
      targetCollectionId,
      createItem,
      ingestItem,
    });
    markEntrySaved(entry.id);

    const colName = targetCollectionId
      ? collections?.find((c) => c.id === targetCollectionId)?.name
      : undefined;

    toast.success(colName ? `Saved to "${colName}"` : 'Saved to Library', {
      description: `"${entry.title.slice(0, 48)}..." added to your collection.`,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Could not add feed item.';
    toast.error('Failed to save to library', { description: msg });
  } finally {
    setEntrySaving(entry.id, false);
  }
}
