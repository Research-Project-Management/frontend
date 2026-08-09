import type { Metadata } from 'next';
import { ChatAiDetail } from '@/features/workspaces';

export const metadata: Metadata = { title: 'AI' };

export default function ChatDetailPage() {
  return <ChatAiDetail />;
}
