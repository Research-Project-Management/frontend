import { describe, it, expect } from 'vitest';
import {
  STICKY_COLOR_MAP,
  STICKY_COLOR_CYCLE,
} from '@/features/workspaces/projects/stickies/types/sticky.types';

describe('sticky.types', () => {
  it('defines valid hex background and text colors for each color key', () => {
    STICKY_COLOR_CYCLE.forEach((colorKey) => {
      const config = STICKY_COLOR_MAP[colorKey];
      expect(config).toBeDefined();
      expect(config.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('contains all 8 colors in the default cycle order', () => {
    expect(STICKY_COLOR_CYCLE.length).toBe(8);
    expect(STICKY_COLOR_CYCLE).toContain('cyan-1');
    expect(STICKY_COLOR_CYCLE).toContain('mint-1');
    expect(STICKY_COLOR_CYCLE).toContain('yellow-1');
    expect(STICKY_COLOR_CYCLE).toContain('lavender-1');
    expect(STICKY_COLOR_CYCLE).toContain('pink-1');
    expect(STICKY_COLOR_CYCLE).toContain('purple-1');
  });
});
