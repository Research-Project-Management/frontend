'use client';

import { QueryProvider } from '@/shared/lib/react-query';
import { SocketProvider } from '@/shared/components/providers/SocketProvider';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { SplashLoader } from '@/shared/components/ui/SplashLoader';
import { useState, useEffect } from 'react';
import NavigationProgress from '@/shared/components/ui/NavigationProgress';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 450);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryProvider>
      <SocketProvider>
        <TooltipProvider delayDuration={200}>
          <SplashLoader isLoading={isInitialLoading} />
          <NavigationProgress />
          {children}
          <Toaster
            position="bottom-right"
            richColors
            expand={false}
            visibleToasts={3}
            closeButton
            duration={3000}
            toastOptions={{
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                backdropFilter: 'blur(8px)',
              },
              className: 'flux-toast',
            }}
          />
        </TooltipProvider>
      </SocketProvider>
    </QueryProvider>
  );
}
