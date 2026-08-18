import { describe, it, expect } from 'vitest';
import {
  defaultSectionConfig,
  getGreeting,
  loadSectionConfig,
  saveSectionConfig,
  STORAGE_KEY,
} from '@/features/workspaces/projects/home/utils/home-page.util';

describe('Home Page Domain Utilities (home-page.util.ts)', () => {
  it('returns valid default section configuration', () => {
    const config = defaultSectionConfig();
    expect(config).toHaveLength(3);
    expect(config.every((c) => c.visible)).toBe(true);
  });

  it('calculates greeting according to time of day', () => {
    expect(getGreeting(8).text).toBe('Good morning');
    expect(getGreeting(12).text).toBe('Good noon');
    expect(getGreeting(15).text).toBe('Good afternoon');
    expect(getGreeting(20).text).toBe('Good evening');
    expect(getGreeting(2).text).toBe('Good night');
  });

  it('handles loading and saving section config with localStorage', () => {
    const customConfig = [
      { id: 'quicklinks' as const, visible: false },
      { id: 'recent' as const, visible: true },
      { id: 'stickies' as const, visible: true },
    ];
    saveSectionConfig(customConfig);
    const loaded = loadSectionConfig();
    expect(loaded.find((c) => c.id === 'quicklinks')?.visible).toBe(false);
  });
});
