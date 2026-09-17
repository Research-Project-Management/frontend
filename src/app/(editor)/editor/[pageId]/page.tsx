import type { Metadata } from 'next';
import ClientEditor from '@/features/editor/pages/ClientEditor';

export const metadata: Metadata = { title: 'Page · Flux' };

export default function EditorPageWrapper() {
  return <ClientEditor />;
}
