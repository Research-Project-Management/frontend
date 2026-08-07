import type { Metadata } from 'next';
import { StickyLayout } from '@/features/stickies';

export const metadata: Metadata = { title: 'Stickies · Flux' };

export default function StickiesPage() {
  return <StickyLayout />;
}
