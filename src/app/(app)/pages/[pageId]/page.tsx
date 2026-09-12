import type { Metadata } from 'next';
import EditorPage from '@/features/editor/pages/EditorPage';

export const metadata: Metadata = { title: 'Page · Flux' };

export default function WorkspacePagesDetail() {
  return <EditorPage />;
}
