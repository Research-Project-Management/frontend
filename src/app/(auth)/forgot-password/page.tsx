import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Forgot Password · Flux',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}

