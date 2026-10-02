import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordContent from '@/features/auth/pages/reset-password-page';

export const metadata: Metadata = {
  title: 'Reset Password · Flux',
  description: 'Set a new password for your Flux account',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
