import type { Metadata } from 'next';
import ClientEditor from '@/features/editor/ui/shell/ClientEditor';

export const metadata: Metadata = { title: 'Document Editor · Flux' };

export default function ProjectPageDetail() {
  return <ClientEditor />;
}
