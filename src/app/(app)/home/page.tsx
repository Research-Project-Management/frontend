import type { Metadata } from 'next';
import HomePage from '@/features/projects/home/pages/home-page';

export const metadata: Metadata = {
  title: 'Home · Flux',
  description: 'Your personal research dashboard and workspace.',
};

export default function HomeRoute() {
  return <HomePage />;
}
