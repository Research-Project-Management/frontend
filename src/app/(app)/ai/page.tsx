import type { Metadata } from 'next';
import { Suspense } from 'react';
import ChatPage from '@/features/workspaces/ai/pages/chat-page';

export const metadata: Metadata = { title: 'AI · Flux' };

export default function AiIndexPage() {
  return (
    <Suspense fallback={null}>
      <ChatPage />
    </Suspense>
  );
}
