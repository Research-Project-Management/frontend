import type { Metadata } from 'next';
import { StickyLayout } from '@/features/stickies';

export const metadata: Metadata = { title: 'Notes - Flux' };

export default function ProjectStickiesPage() {
  return <StickyLayout scope="project" />;
}
