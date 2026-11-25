import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Flux account',
};

export { default } from '@/features/auth/pages/login-page';
