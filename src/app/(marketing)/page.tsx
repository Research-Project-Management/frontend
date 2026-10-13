import type { Metadata } from 'next';
import LandingPage from '@/features/marketing/pages/landing-page';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Flux — Research Management Platform',
  description:
    'Manage your research projects, papers, and team collaboration in one place. Built for academic research teams.',
  openGraph: {
    title: 'Flux — Research Management Platform',
    description:
      'Manage your research projects, papers, and team collaboration in one place.',
    type: 'website',
  },
};

export default function Page() {
  return <LandingPage />;
}
