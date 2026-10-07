import type { Metadata } from 'next';
import { InboxPage } from '@/features/shell';

export const metadata: Metadata = {
  title: 'Inbox · Flux',
  description: 'Manage and review project invitations, manuscript mentions, and comments.',
};

export default function Page() {
  return <InboxPage />;
}
