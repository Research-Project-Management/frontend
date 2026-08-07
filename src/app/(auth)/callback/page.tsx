'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/shared/components/ui/Loading';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/dashboard');
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p>Signing in...</p>
      </div>
    </div>
  );
}
