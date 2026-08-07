import type { Metadata } from 'next';
import { EditorLayout } from '@/features/editor';

export const metadata: Metadata = { title: 'Page Â· Flux' };

export default function WorkspacePagesDetail() {
  return <EditorLayout />;
}
