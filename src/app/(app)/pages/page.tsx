import '@/shared/lib/dom-polyfill';
import type { Metadata } from 'next';
import PagesView from '@/features/pages/PagesView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pages' };

export default function PagesRoute() {
  return <PagesView />;
}
