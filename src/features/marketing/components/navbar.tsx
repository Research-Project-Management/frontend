'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Menu, X, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useWorkspaces } from '@/features/workspaces/shell/hooks/use-workspace';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const { workspaces = [], isLoading: isWorkspacesLoading } = useWorkspaces();

  const isLoading = isAuthLoading || isWorkspacesLoading;
  const workspaceTarget =
    workspaces && workspaces.length > 0
      ? `/${(workspaces[0] as any).url}`
      : '/dashboard';


  // Harden: debounce + passive scroll listener
  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 10);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Harden: close menu on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 w-full border-b border-border transition-colors duration-200 ${
        isScrolled
          ? 'bg-card/90 backdrop-blur-md'
          : 'bg-background'
      }`}
      aria-label='Main navigation'
    >
      <div className='flux-container'>
        <div className='flex justify-between items-center h-14'>

          {/* Logo */}
          <Link
            href='/'
            className='flex gap-2.5 items-center min-h-[44px]'
            onClick={() => setIsMenuOpen(false)}
            aria-label='Flux home'
          >
            <img src='/Flux.svg' className='h-8 w-auto object-contain' alt='' aria-hidden='true' />
            <span className='font-bold text-lg tracking-tight'>Flux</span>
          </Link>

          {/* Desktop Actions */}
          <div className='hidden md:flex items-center gap-2'>
            {!isLoading && user ? (
              <Link
                href={workspaceTarget}
                className='group flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
              >
                <LayoutDashboard className='w-4 h-4' />
                <span>Go to Workspace</span>
                <ArrowRight className='w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5' aria-hidden='true' />
              </Link>
            ) : (
              <>
                <Link
                  href='/login'
                  className='flex h-9 items-center px-4 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
                >
                  Sign in
                </Link>
                <Link
                  href='/register'
                  className='group flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
                >
                  Get started
                  <ArrowRight className='w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5' aria-hidden='true' />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className='flex items-center justify-center w-11 h-11 rounded-lg transition-colors hover:bg-secondary md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen
              ? <X className='w-5 h-5' aria-hidden='true' />
              : <Menu className='w-5 h-5' aria-hidden='true' />
            }
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className='md:hidden py-4 border-t border-border'
            >
              <div className='flex flex-col gap-2'>
                {!isLoading && user ? (
                  <Link
                    href={workspaceTarget}
                    className='flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <LayoutDashboard className='w-4 h-4' />
                    <span>Go to Workspace</span>
                    <ArrowRight className='w-3.5 h-3.5' aria-hidden='true' />
                  </Link>
                ) : (
                  <>
                    <Link
                      href='/login'
                      className='flex items-center justify-center min-h-[44px] rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link
                      href='/register'
                      className='flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Get started
                      <ArrowRight className='w-3.5 h-3.5' aria-hidden='true' />
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
