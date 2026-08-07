import type { Metadata } from 'next';
import { LandingPage } from '@/features/marketing';


export const metadata: Metadata = {
  title: 'Flux — Research Management Platform',
  description: 'Manage your research projects, papers, and team collaboration in one place.',
};

export default function Page() {
  return <LandingPage />;
}

