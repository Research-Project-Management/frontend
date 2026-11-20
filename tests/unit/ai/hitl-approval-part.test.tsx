import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  HitlApprovalPart,
  type HitlPartData,
} from '@/features/ai/ui/parts/HitlApprovalPart';

afterEach(() => {
  cleanup();
});

function makeTrashPart(overrides?: Partial<HitlPartData>): HitlPartData {
  return {
    type: 'hitl',
    interruptId: 'lib-2-0-trash_items',
    status: 'pending',
    interrupts: [
      {
        id: 'lib-2-0-trash_items',
        tool: 'trash_items',
        description:
          'Move 1 library item to Trash: "Attention Is All You Need"',
        args: {
          item_ids: ['01a1b589-753d-750e-b599-a658c4596a86'],
          items: [
            {
              id: '01a1b589-753d-750e-b599-a658c4596a86',
              title: 'Attention Is All You Need',
            },
          ],
        },
        allowedDecisions: ['approve', 'reject'],
      },
    ],
    ...overrides,
  };
}

describe('HitlApprovalPart', () => {
  it('renders structured trash_items confirmation, hides raw JSON until Details is expanded, and dispatches decisions', () => {
    const onResume = vi.fn();
    render(<HitlApprovalPart part={makeTrashPart()} onResume={onResume} />);

    const region = screen.getByRole('region', { name: 'Move to Trash' });
    expect(region).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('heading', { level: 4, name: 'Move to Trash' })).toBeInTheDocument();
    expect(screen.getByText('Confirmation required')).toBeInTheDocument();
    expect(screen.getByText('Attention Is All You Need')).toBeInTheDocument();
    expect(screen.getByText('01a1b589')).toBeInTheDocument();

    // Raw JSON and tool slug are hidden by default
    expect(screen.queryByText(/"item_ids"/)).not.toBeInTheDocument();

    const detailsBtn = screen.getByRole('button', { name: /Details/i });
    expect(detailsBtn).toHaveAttribute('aria-expanded', 'false');
    expect(detailsBtn).not.toHaveAttribute('aria-controls');

    fireEvent.click(detailsBtn);
    expect(detailsBtn).toHaveAttribute('aria-expanded', 'true');
    const controlsId = detailsBtn.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const pre = document.querySelector(`#${controlsId} pre`);
    expect(pre).not.toBeNull();
    expect(pre).toHaveAttribute('tabindex', '0');
    expect(pre?.textContent).toContain('"item_ids"');

    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    expect(onResume).toHaveBeenCalledWith([
      { decision: 'approve', interruptId: 'lib-2-0-trash_items' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onResume).toHaveBeenCalledWith([
      { decision: 'reject', interruptId: 'lib-2-0-trash_items' },
    ]);
  });

  it('renders merge_duplicates with Primary and Duplicate badges and Merge items CTA', () => {
    const part: HitlPartData = {
      type: 'hitl',
      interruptId: 'lib-3-0-merge_duplicates',
      status: 'pending',
      interrupts: [
        {
          id: 'lib-3-0-merge_duplicates',
          tool: 'merge_duplicates',
          args: {
            primary_item_id: '11111111-1111-4111-8111-111111111111',
            primary_title: 'Deep Residual Learning',
            duplicate_item_ids: ['22222222-2222-4222-8222-222222222222'],
            duplicates: [
              {
                id: '22222222-2222-4222-8222-222222222222',
                title: 'Deep Residual Learning (Duplicate)',
              },
            ],
          },
        },
      ],
    };

    render(<HitlApprovalPart part={part} onResume={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 4, name: 'Merge duplicate items' })).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Deep Residual Learning')).toBeInTheDocument();
    expect(screen.getByText('Deep Residual Learning (Duplicate)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge items' })).toBeInTheDocument();
  });

  it('strips legacy UUID suffix from generic descriptions and formats fields', () => {
    const part: HitlPartData = {
      type: 'hitl',
      interruptId: 'gen-1',
      status: 'pending',
      interrupts: [
        {
          id: 'gen-1',
          tool: 'create_work_item',
          description:
            'Create task for "Paper review" (01a1b589-753d-750e-b599-a658c4596a86)',
          args: {
            priority: 'high',
            assignee: 'Dr. Lan',
          },
        },
      ],
    };

    render(<HitlApprovalPart part={part} onResume={vi.fn()} />);

    expect(screen.getByText('Create task for "Paper review"')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByText('Dr. Lan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('handles submitting, approved, rejected with reason, and empty interrupts states', () => {
    const { rerender } = render(
      <HitlApprovalPart
        part={makeTrashPart({ status: 'submitting' })}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Applying…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Moving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    rerender(
      <HitlApprovalPart
        part={makeTrashPart({ status: 'approved' })}
        onResume={vi.fn()}
      />,
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move to Trash' })).not.toBeInTheDocument();

    rerender(
      <HitlApprovalPart
        part={makeTrashPart({ status: 'rejected', reason: 'Keep this reference.' })}
        onResume={vi.fn()}
      />,
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Keep this reference.')).toBeInTheDocument();

    rerender(
      <HitlApprovalPart
        part={{
          type: 'hitl',
          interruptId: 'empty-1',
          status: 'pending',
          interrupts: [],
        }}
        onResume={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Review and confirm this action before continuing.'),
    ).toBeInTheDocument();
  });
});
