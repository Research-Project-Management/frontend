'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Debounced passive scroll listener
  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 10);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Close menu on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 w-full border-b border-border transition-colors duration-150 ${
        isScrolled
          ? 'bg-card/85 backdrop-blur-md shadow-2xs'
          : 'bg-background/80 backdrop-blur-sm'
      }`}
      aria-label='Main navigation'
    >
      <div className='flux-container'>
        <div className='flex justify-between items-center h-12'>

          {/* Logo */}
          <div className='flex items-center'>
            <Link
              href='/'
              className='flex gap-2.5 items-center min-h-10 shrink-0'
              onClick={() => setIsMenuOpen(false)}
              aria-label='Flux home'
            >
              <img
                src='/Flux.svg'
                className='size-6 shrink-0 object-contain'
                alt='Flux'
              />
              <span className='font-semibold text-lg tracking-tight text-foreground'>
                Flux
              </span>
            </Link>
          </div>

          {/* Desktop Actions */}
          <div className='hidden md:flex items-center gap-2'>
            <Link
              href='/login'
              className='flex h-8 items-center px-3 text-13 font-medium text-foreground rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0'
            >
              Sign in
            </Link>
            <Link
              href='/register'
              className='group flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-13 font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0 shadow-2xs'
            >
              Get started
              <ArrowRight
                className='size-3.5 transition-transform group-hover:translate-x-0.5 shrink-0'
                aria-hidden='true'
              />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className='flex items-center justify-center w-10 h-10 rounded-md transition-colors hover:bg-muted md:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <X className='size-5 shrink-0' aria-hidden='true' />
            ) : (
              <Menu className='size-5 shrink-0' aria-hidden='true' />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className='md:hidden py-4 border-t border-border'
            >
              <div className='flex flex-col gap-2'>
                <Link
                  href='/login'
                  className='flex items-center justify-center h-9 rounded-md border border-border px-4 text-13 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0'
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href='/register'
                  className='flex items-center justify-center gap-1.5 h-9 rounded-md bg-primary px-4 text-13 font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0 shadow-2xs'
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get started
                  <ArrowRight className='size-3.5 shrink-0' aria-hidden='true' />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
