import type { Metadata } from 'next';
import HomePage from '@/features/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Storage' };

export default function ProjectStoragePage() {
  return <HomePage />;
}
