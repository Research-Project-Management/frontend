'use client';

import React from 'react';
import Link from 'next/link';
import Loading from '@/shared/components/ui/Loading';
import { useAuth } from '@/features/auth';

export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block">
                Flux
              </span>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container flex h-[calc(100vh-3.5rem)] items-center justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}
