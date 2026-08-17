import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverviewCards } from '@/features/workspaces/projects/your-work/components/summary/OverviewCards';

vi.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-123' }),
}));

describe('OverviewCards', () => {
  it('renders overview cards with proper counts and hrefs', () => {
    render(
      <OverviewCards
        createdCount={5}
        assignedCount={12}
        subscribedCount={3}
      />,
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    const createdLink = screen.getByRole('link', { name: /Work items created/i });
    expect(createdLink).toHaveAttribute('href', '/ws-123/your-work/created');

    const assignedLink = screen.getByRole('link', { name: /Work items assigned/i });
    expect(assignedLink).toHaveAttribute('href', '/ws-123/your-work/assigned');

    const subscribedLink = screen.getByRole('link', { name: /Work items subscribed/i });
    expect(subscribedLink).toHaveAttribute('href', '/ws-123/your-work/subscribed');
  });
});
