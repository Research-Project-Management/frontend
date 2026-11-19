import { fetchDocumentsBulk } from '../transport/docs';
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
    return uniqueIds.map((id) => {
      const found = byId.get(id);
      return {
        id,
        name: found?.name || id,
        size: found?.size,
        enabled: true,
        sourceType: 'upload',
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
