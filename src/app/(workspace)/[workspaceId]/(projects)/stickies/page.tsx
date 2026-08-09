import type { Metadata } from 'next';
import { StickyLayout } from '@/features/workspaces/projects';

export const metadata: Metadata = { title: 'Stickies · Flux' };

export default function StickiesPage() {
  return <StickyLayout />;
}
