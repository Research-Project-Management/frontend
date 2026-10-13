import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ChatPage from '@/features/ai/pages/chat-page';

export const metadata: Metadata = { title: 'AI Chat · Flux' };

export default function ChatDetailPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <ChatPage />
    </Suspense>
  );
}
