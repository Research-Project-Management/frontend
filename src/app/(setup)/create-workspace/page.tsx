import type { Metadata } from 'next';
import { CreateWorkspacePage } from '@/features/setup';

export const metadata: Metadata = {
  title: 'Create Workspace · Flux',
};

export default function Page() {
  return <CreateWorkspacePage />;
}
