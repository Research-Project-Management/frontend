import type { Metadata } from 'next';
import { EditorPage } from '@/features/editor';

export const metadata: Metadata = { title: 'Page A Flux' };

export default function ProjectPageDetail() {
  return <EditorPage />;
}
