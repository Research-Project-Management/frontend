import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { HeroCta } from '@/features/marketing/components/hero-cta';
import { SectionCta } from '@/features/marketing/components/section-cta';

// Mock useAuth to simulate unauthenticated guest on initial load
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

vi.mock('@/shared/lib/token-storage', () => ({
  hasAuthToken: () => false,
  getAuthToken: () => null,
}));

describe('Marketing Static Pre-rendering & Client Islands', () => {
  it('HeroCta renders public unauthenticated action buttons for SEO and initial SSR', () => {
    render(<HeroCta />);

    const startLink = screen.getByRole('link', { name: /start for free/i });
    expect(startLink).toBeInTheDocument();
    expect(startLink).toHaveAttribute('href', '/register');

    const signInLink = screen.getByRole('link', { name: /sign in/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute('href', '/login');
  });

  it('SectionCta renders get started and GitHub repository links', () => {
    render(<SectionCta />);

    const getStartedLink = screen.getByRole('link', { name: /get started/i });
    expect(getStartedLink).toBeInTheDocument();
    expect(getStartedLink).toHaveAttribute('href', '/register');

    const githubLink = screen.getByRole('link', { name: /view flux on github/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/Research-Project-TDTU');
  });
});
