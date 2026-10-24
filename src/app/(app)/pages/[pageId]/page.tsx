import '@/shared/lib/dom-polyfill';
import type { Metadata } from 'next';
import ClientEditor from '@/features/editor/core/shell/ClientEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Page — Flux' };

export default function PagesDetailPage() {
  return <ClientEditor />;
}
