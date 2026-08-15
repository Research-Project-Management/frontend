import type { Metadata } from 'next';
import { FavoritesPage } from '@/features/workspaces/library';

export const metadata: Metadata = { title: 'Favorites · Library · Flux' };

export default function LibraryFavoritesPage() {
  return <FavoritesPage />;
}
