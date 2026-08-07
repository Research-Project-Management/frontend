'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      // Pathname changed - navigation completed
      prevPathname.current = pathname;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }
  }, [pathname]);

  // Expose a way to trigger from router events via a global flag (simplified)
  // In Next.js App Router there's no built-in navigation state, 
  // so we just show progress on mount briefly for initial loads
  useEffect(() => {
    setVisible(true);
    setProgress(10);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 80) return prev;
        const increment = Math.max(1, (80 - prev) * 0.1);
        return Math.min(prev + increment, 80);
      });
    }, 150);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_10px_rgba(51,112,255,0.5)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
