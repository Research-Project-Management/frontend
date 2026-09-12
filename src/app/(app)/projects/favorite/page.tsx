import type { Metadata } from 'next';
import { Suspense } from 'react';
import FavoritesPage from '@/features/workspaces/projects/shell/pages/FavoritesPage';

export const metadata: Metadata = {
  title: 'Favorite Projects · Flux',
  description: 'Quick access to your starred research projects.',
};

export default function FavoriteProjectsRoute() {
  return (
    <Suspense fallback={null}>
      <FavoritesPage />
    </Suspense>
  );
}
