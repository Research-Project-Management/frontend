import type { Metadata } from 'next';
import { ChatPage } from '@/features/workspaces/ai';

export const metadata: Metadata = { title: 'AI · Flux' };

export default function AiIndexPage() {
  return <ChatPage />;
}
