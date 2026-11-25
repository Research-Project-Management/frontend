import type { Metadata } from 'next';
import { ChatPage } from '@/features/ai';

export const metadata: Metadata = { title: 'AI' };

export default function AiIndexPage() {
  return <ChatPage />;
}
