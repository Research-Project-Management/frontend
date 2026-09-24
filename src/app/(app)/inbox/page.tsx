import { Metadata } from 'next';
import InboxView from '@/features/inbox/components/InboxView';

export const metadata: Metadata = {
  title: 'Inbox | Flux',
  description: 'Manage and review project invitations, manuscript mentions, and comments.',
};

export default function InboxPage() {
  return <InboxView />;
}
