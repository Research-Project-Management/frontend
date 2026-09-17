import type { Metadata } from 'next';
import ClientEditor from '@/features/editor/pages/ClientEditor';

export const metadata: Metadata = { title: 'Draft · Editor · Flux' };

export default function DraftEditorPage() {
  return <ClientEditor />;
}
