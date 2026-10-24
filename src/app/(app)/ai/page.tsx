import type { Metadata } from 'next';
import ChatPage from '@/features/ai/pages/chat-page';

export const metadata: Metadata = { title: 'AI · Flux' };

export default function AiIndexPage() {
  return <ChatPage />;
}
