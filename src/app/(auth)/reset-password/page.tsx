import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ResetPasswordContent from '@/features/auth/pages/reset-password-page';

export const metadata: Metadata = {
  title: 'Reset Password · Flux',
  description: 'Set a new password for your Flux account',
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary shrink-0" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
