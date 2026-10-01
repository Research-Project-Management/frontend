import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password · Flux',
  description: 'Set a new password for your Flux account',
};

export { default } from '@/features/auth/pages/reset-password-page';
