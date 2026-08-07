import type { Metadata } from 'next';
import { CycleLayout } from '@/features/cycles';

export const metadata: Metadata = { title: 'Research Cycles · Flux' };

export default function CyclesPage() {
  return <CycleLayout />;
}
