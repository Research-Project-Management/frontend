import type { Metadata } from 'next';
import { SharedPage } from '@/features/storage';

export const metadata: Metadata = { title: 'Shared · Storage · Flux' };

export default function ProjectSharedPage() {
  return <SharedPage />;
}
