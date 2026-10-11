import type { Metadata } from 'next';
import ClientEditor from '@/features/editor/ui/shell/ClientEditor';

export const metadata: Metadata = { title: 'Project Editor · Flux' };

export default function CanonicalProjectEditorPage() {
  return <ClientEditor />;
}
