import type { Metadata } from 'next';
import { Suspense } from 'react';
import ChatPage from '@/features/workspaces/ai/pages/chat-page';

export const metadata: Metadata = { title: 'AI Chat · Flux' };

export default function ChatDetailPage() {
  return (
    <Suspense fallback={null}>
      <ChatPage />
    </Suspense>
  );
}
