import type { Metadata } from 'next';
import { ChatView } from '@/features/chat/components/ChatView';

export const metadata: Metadata = {
  title: 'Messages & Channels · Flux',
  description: 'Unified Messenger, Discord-style Project Channels, and Collaborative Discussions',
};

export default function ChatPage() {
  return (
    <div className="size-full overflow-hidden">
      <ChatView />
    </div>
  );
}
