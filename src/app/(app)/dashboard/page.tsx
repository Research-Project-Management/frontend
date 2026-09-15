import type { Metadata } from 'next';
import HomePage from '@/features/projects/home/pages/home-page';

export const metadata: Metadata = {
  title: 'Dashboard · Flux',
  description: 'Your personal research dashboard.',
};

export default function DashboardRoute() {
  return <HomePage />;
}
