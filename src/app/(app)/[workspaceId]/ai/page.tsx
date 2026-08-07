import type { Metadata } from 'next';
import { EmptyState } from '@/features/chat-ai';

export const metadata: Metadata = { title: 'Flux AI' };

export default function AiIndexPage() {
  return <EmptyState />;
}
