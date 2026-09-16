import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = { title: 'Page · Flux' };

const EditorPage = dynamic(
  () => import('@/features/editor/pages/EditorPage'),
  { ssr: false },
);

export default function EditorPageWrapper() {
  return <EditorPage />;
}
