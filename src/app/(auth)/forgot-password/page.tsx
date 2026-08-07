import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password · Flux',
  description: 'Reset your Flux account password',
};

export { default } from '@/features/auth/pages/forgot-password-page';
