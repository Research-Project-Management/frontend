import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register · Flux',
  description: 'Create a new Flux account',
};

export { default } from '@/features/auth/pages/register-page';
