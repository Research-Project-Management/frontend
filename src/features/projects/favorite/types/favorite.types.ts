export interface UseFavoritesState {
  readonly favoriteIds: Set<string>;
  readonly isPending: boolean;
  readonly count: number;
}

export interface UseFavoritesActions {
  toggleFavorite: (id: string, e?: React.MouseEvent) => void;
  isFavorite: (id: string) => boolean;
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  clearFavorites: () => void;
}

export interface UseFavoritesReturn {
  state: UseFavoritesState;
  actions: UseFavoritesActions;
  // Backwards compatibility aliases
  favoriteIds: Set<string>;
  toggleFavorite: (id: string, e?: React.MouseEvent) => void;
  isFavorite: (id: string) => boolean;
  isPending: boolean;
}
