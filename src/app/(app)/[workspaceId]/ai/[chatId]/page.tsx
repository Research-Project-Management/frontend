import type { Metadata } from 'next';
import { ChatAiDetail } from '@/features/chat-ai';

export const metadata: Metadata = { title: 'Flux AI' };

export default function ChatDetailPage() {
  return <ChatAiDetail />;
}
