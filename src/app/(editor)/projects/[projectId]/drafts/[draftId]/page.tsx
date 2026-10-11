import type { Metadata } from 'next';
import ClientEditor from '@/features/editor/ui/shell/ClientEditor';

export const metadata: Metadata = { title: 'Draft · Editor · Flux' };

export default function DraftEditorPage() {
  return <ClientEditor />;
}
