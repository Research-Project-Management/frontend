import { Metadata } from 'next';
import { InviteAcceptPage } from '@/features/workspaces/invitation';

export const metadata: Metadata = {
  title: 'Workspace Invitation · Flux',
  description: 'You have been invited to collaborate on Flux',
};

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <InviteAcceptPage token={resolvedParams.token} />;
}
