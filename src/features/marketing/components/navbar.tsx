'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-200 ${
        isScrolled
          ? 'bg-background/90 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <div className='flux-container'>
        <div className='flex justify-between items-center h-16'>
          {/* Logo */}
          <Link
            href='/'
            className='flex gap-2.5 items-center'
            onClick={() => setIsMenuOpen(false)}
          >
            <img src='/Flux.svg' className='w-6 h-6 text-foreground' alt='Flux' />
            <div className='font-semibold text-lg'>Flux</div>
          </Link>

          {/* Desktop Actions */}
          <div className='hidden md:flex items-center gap-2'>
            <Link
              href='/login'
              className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'
            >
              Sign in
            </Link>
            <Link
              href='/create'
              className='group flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90'
            >
              Get started
              <ArrowRight className='w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform' />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className='rounded-md p-2 transition-colors hover:bg-secondary md:hidden'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label='Toggle menu'
          >
            {isMenuOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className='md:hidden py-4 border-t border-border'>
            <div className='flex flex-col gap-2'>
              <Link
                href='/login'
                className='rounded-md border border-border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-secondary'
                onClick={() => setIsMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href='/create'
                className='flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90'
                onClick={() => setIsMenuOpen(false)}
              >
                Get started
                <ArrowRight className='w-3.5 h-3.5' />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
