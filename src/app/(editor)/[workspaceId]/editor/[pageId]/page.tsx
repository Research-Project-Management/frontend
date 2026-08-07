import type { Metadata } from 'next';
import { EditorLayout } from '@/features/editor';

export const metadata: Metadata = { title: 'Page · Flux' };

export default function EditorPage() {
  return <EditorLayout />;
}
