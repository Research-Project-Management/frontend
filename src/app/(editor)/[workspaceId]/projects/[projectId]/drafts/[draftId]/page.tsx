import type { Metadata } from 'next';
import { EditorPage } from '@/features/editor';

export const metadata: Metadata = { title: 'Draft · Editor · Flux' };

export default function DraftEditorPage() {
  return <EditorPage />;
}
