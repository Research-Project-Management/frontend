import type { Metadata } from 'next';
import PagesView from '@/features/pages/PagesView';

export const metadata: Metadata = { title: 'Pages' };

export default function ProjectPagesRoute() {
  return <PagesView />;
}
