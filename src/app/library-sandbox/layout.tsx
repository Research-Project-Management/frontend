'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/features/library/components/Sidebar';
import { useLibrarySidebarStore } from '@/features/library/store/sidebar.store';
import { TooltipProvider, Button } from "@/shared/components/ui";
import { ShieldCheck, Server, RefreshCw, Sparkles, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function LibrarySandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname.includes('/library-sandbox/papers/');
  const { isOpen } = useLibrarySidebarStore();

  const [backendUrl, setBackendUrl] = useState('http://localhost:3005');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('FLUX_API_BASE_URL');
    if (stored) {
      setBackendUrl(stored);
    } else {
      localStorage.setItem('FLUX_API_BASE_URL', 'http://localhost:3005');
      setBackendUrl('http://localhost:3005');
    }

    // Set mock sandbox tokens so all requests proceed without login barrier
    if (!localStorage.getItem('auth_token')) {
      localStorage.setItem('auth_token', 'dev-sandbox-token');
    }

    document.documentElement.classList.add('overflow-hidden');
    document.body.classList.add('overflow-hidden');
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const switchBackend = (url: string) => {
    localStorage.setItem('FLUX_API_BASE_URL', url);
    setBackendUrl(url);
    toast.success(`Switched backend API target to: ${url}`, {
      description: 'Reloading queries...',
    });
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh w-full flex-col bg-background overflow-hidden relative select-none">
        {/* Isolated Sandbox Header Banner */}
        <header className="h-10 shrink-0 bg-primary/10 border-b border-primary/20 px-4 flex items-center justify-between text-xs z-50">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-foreground">Library & Reader Sandbox</span>
            <span className="text-muted-foreground hidden sm:inline">
              | Cách ly độc lập 100% khỏi các module khác
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-background/80 px-2 py-0.5 rounded border text-muted-foreground">
              <Server className="h-3 w-3 text-primary" />
              <span>BE: <strong className="text-foreground">{backendUrl}</strong></span>
            </div>

            {mounted && (
              <div className="flex items-center gap-1">
                {backendUrl === 'http://localhost:3005' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-11"
                    onClick={() => switchBackend('http://localhost:3000')}
                    title="Switch to default monolith backend on port 3000"
                  >
                    Dùng Port 3000
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-11 text-emerald-600 font-semibold"
                    onClick={() => switchBackend('http://localhost:3005')}
                    title="Switch to standalone isolated backend on port 3005"
                  >
                    Dùng Port 3005 (Standalone)
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-11 gap-1"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-3 w-3" />
                  Làm mới
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Workspace Body */}
        {isReader ? (
          <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
            {children}
          </main>
        ) : (
          <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
            {isOpen && (
              <Suspense fallback={<aside className="w-64 border-r border-border shrink-0 bg-sidebar" />}>
                <Sidebar />
              </Suspense>
            )}

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
              <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                {children}
              </main>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
