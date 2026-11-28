import type { TagWithCount } from '@/features/library/types/core.types';
import { libraryClient, resolveLibraryUrl, isProjectScope } from './http.client';

function getTagsUrl(spaceId?: string, suffix = ''): string {
  return resolveLibraryUrl('catalog', '/tags', spaceId, suffix);
}


export const TagsService = {
  list: async (spaceId?: string): Promise<TagWithCount[]> => {
    const raw = await libraryClient.get<
      TagWithCount[] | { data?: TagWithCount[]; tags?: TagWithCount[] }
    >(getTagsUrl(spaceId));
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.tags)) return raw.tags;
      if (Array.isArray(raw.data)) return raw.data;
    }
    return [];
  },

  create: async (
    spaceId: string | undefined,
    name: string,
    color?: string,
    type: string = 'manual',
    shortcut?: number | null,
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.post<
      TagWithCount | { data?: TagWithCount; tag?: TagWithCount }
    >(
      getTagsUrl(spaceId),
      {
        name,
        color,
        type,
        ...(shortcut !== undefined ? { shortcut } : {}),
        ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
      },
    );
    if (raw && typeof raw === 'object') {
      if ('tag' in raw && raw.tag) return raw.tag;
      if ('data' in raw && raw.data) return raw.data;
    }
    return raw as TagWithCount;
  },

  update: async (
    spaceId: string | undefined,
    tagId: string,
    data: { name?: string; color?: string; type?: string; shortcut?: number | null },
  ): Promise<TagWithCount> => {
    const raw = await libraryClient.patch<
      TagWithCount | { data?: TagWithCount; tag?: TagWithCount }
    >(
      getTagsUrl(spaceId, encodeURIComponent(tagId)),
      data,
    );
    if (raw && typeof raw === 'object') {
      if ('tag' in raw && raw.tag) return raw.tag;
      if ('data' in raw && raw.data) return raw.data;
    }
    return raw as TagWithCount;
  },

  delete: async (spaceId: string | undefined, tagId: string): Promise<void> => {
    await libraryClient.delete<unknown>(getTagsUrl(spaceId, encodeURIComponent(tagId)));
  },

  deleteAutomatic: async (spaceId?: string): Promise<{ count: number }> => {
    const raw = await libraryClient.delete<{ count?: number; data?: { count: number } }>(
      getTagsUrl(spaceId, 'automatic'),
    );
    return raw?.data || (raw && typeof raw.count === 'number' ? { count: raw.count } : { count: 0 });
  },

  split: async (
    spaceId: string | undefined,
    tagId: string,
    parts: string[],
  ): Promise<{ tags: TagWithCount[]; count: number }> => {
    const raw = await libraryClient.post<{
      tags?: TagWithCount[];
      count?: number;
      data?: { tags?: TagWithCount[]; count?: number };
    }>(getTagsUrl(spaceId, `${encodeURIComponent(tagId)}/split`), {
      parts,
      ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
    });
    const tags = raw?.tags || raw?.data?.tags || [];
    return {
      tags,
      count: raw?.count ?? raw?.data?.count ?? tags.length,
    };
  },
};
