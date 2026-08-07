import type { Metadata } from 'next';
import { EditorLayout, PageLayout } from '@/features/editor';

export const metadata: Metadata = { title: 'Page A Flux' };

export default function ProjectPageDetail() {
  return (
    <PageLayout>
      <EditorLayout />
    </PageLayout>
  );
}
