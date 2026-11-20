import { fetchDocumentsBulk } from '../transport/docs';
import { ItemsService } from '@/features/library/sdk/clients/items.client';
import type { SourceEntry } from './source.port';

export async function hydrateSourceNames(
  ids: string[],
  spaceId?: string | null,
): Promise<SourceEntry[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  try {
    const docs = await fetchDocumentsBulk(uniqueIds, spaceId);
    const byId = new Map(docs.map((d) => [d.id, d]));

    const missingIds = uniqueIds.filter((id) => !byId.has(id));
    const libraryMap = new Map<string, string>();
    if (missingIds.length > 0) {
      await Promise.allSettled(
        missingIds.map(async (id) => {
          try {
            const item = await ItemsService.getById(spaceId || undefined, id);
            if (item?.title) {
              libraryMap.set(id, item.title);
            }
          } catch {}
        }),
      );
    }

    return uniqueIds.map((id) => {
      const found = byId.get(id);
      const libTitle = libraryMap.get(id);
      return {
        id,
        name: found?.name || libTitle || id,
        size: found?.size,
        enabled: true,
        sourceType: libTitle ? 'library' : 'upload',
      };
    });
  } catch {
    return uniqueIds.map((id) => ({
      id,
      name: id,
      enabled: true,
      sourceType: 'upload',
    }));
  }
}
