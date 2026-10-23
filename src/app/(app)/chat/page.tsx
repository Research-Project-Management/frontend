import AppLoading from '@/app/(app)/loading';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ChatView } from '@/features/chat/components/ChatView';

export const metadata: Metadata = {
  title: 'Messages & Channels · Flux',
  description: 'Unified Messenger, Discord-style Project Channels, and Collaborative Discussions',
};

export default function ChatPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <div className="size-full overflow-hidden">
        <ChatView />
      </div>
    </Suspense>
  );
}
