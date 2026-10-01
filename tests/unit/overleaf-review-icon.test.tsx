import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { OverleafReviewIcon, OverleafReviewSolidIcon } from '@/features/editor/components/sidebar/review/subcomponents/OverleafReviewIcon';

describe('Overleaf Review Icon & Empty State Vector Parity', () => {
  it('renders OverleafReviewIcon with SVG viewBox 0 0 24 24 and evenodd cutout path', () => {
    const { container } = render(<OverleafReviewIcon className="size-4 text-white" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('fill-rule')).toBe('evenodd');
    expect(path?.getAttribute('clip-rule')).toBe('evenodd');
  });

  it('renders OverleafReviewSolidIcon with SVG viewBox 0 0 24 24 and evenodd cutout path for empty state', () => {
    const { container } = render(<OverleafReviewSolidIcon className="size-9 text-white" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('class')).toContain('size-9');
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('fill-rule')).toBe('evenodd');
  });
});
