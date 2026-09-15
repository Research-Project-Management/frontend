import { Metadata } from 'next';
import { InviteAcceptPage } from '@/features/projects/invitation/pages/InviteAcceptPage';

export const metadata: Metadata = {
  title: 'Project Invitation · Flux',
  description: 'You have been invited to collaborate on a research project in Flux',
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
