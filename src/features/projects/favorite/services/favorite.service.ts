import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';

export const FavoriteService = {
  getUserFavoriteIds: () =>
    apiGet<string[]>('/api/v1/projects/favorites/ids'),

  toggleFavorite: (projectId: string) =>
    apiPost<{ isFavorite: boolean }>(`/api/v1/projects/${projectId}/favorite/toggle`),

  addFavorite: (projectId: string) =>
    apiPost<{ isFavorite: boolean }>(`/api/v1/projects/${projectId}/favorite`),

  removeFavorite: (projectId: string) =>
    apiDelete<{ isFavorite: boolean }>(`/api/v1/projects/${projectId}/favorite`),
};
