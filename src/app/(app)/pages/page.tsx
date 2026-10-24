import '@/shared/lib/dom-polyfill';
import type { Metadata } from 'next';
import PagesPage from '@/features/projects/project-id/pages/ProjectPagesView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pages — Flux' };

export default function PagesRoute() {
  return <PagesPage />;
}
