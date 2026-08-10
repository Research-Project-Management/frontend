import type { Metadata } from 'next';
import { EditorPage } from '@/features/editor';

export const metadata: Metadata = { title: 'Page · Flux' };

export default function EditorPageWrapper() {
  return <EditorPage />;
}
