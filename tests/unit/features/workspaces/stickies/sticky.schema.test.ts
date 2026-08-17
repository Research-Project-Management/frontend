import { describe, it, expect } from 'vitest';
import {
  StickyColorSchema,
  StickySchema,
  StickyListResponseSchema,
  CreateStickyPayloadSchema,
} from '@/features/workspaces/projects/stickies/schemas/sticky.schema';

describe('sticky.schema', () => {
  describe('StickyColorSchema', () => {
    it('validates permitted sticky colors', () => {
      const validColors = [
        'cyan-1',
        'cyan-2',
        'mint-1',
        'mint-2',
        'yellow-1',
        'lavender-1',
        'pink-1',
        'purple-1',
      ];
      validColors.forEach((color) => {
        expect(StickyColorSchema.safeParse(color).success).toBe(true);
      });
    });

    it('rejects unknown color strings', () => {
      expect(StickyColorSchema.safeParse('red-99').success).toBe(false);
      expect(StickyColorSchema.safeParse('').success).toBe(false);
    });
  });

  describe('StickySchema', () => {
    it('validates a complete sticky note object', () => {
      const validSticky = {
        _id: 'sticky-1',
        id: 'sticky-1',
        title: 'Project Ideas',
        content: '<p>Some research notes</p>',
        color: 'yellow-1',
        workspaceId: 'ws-123',
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T01:00:00.000Z',
      };

      const parsed = StickySchema.safeParse(validSticky);
      expect(parsed.success).toBe(true);
    });

    it('fails when content or color is missing', () => {
      const invalidSticky = {
        _id: 'sticky-1',
        title: 'Title only',
      };
      expect(StickySchema.safeParse(invalidSticky).success).toBe(false);
    });
  });

  describe('StickyListResponseSchema', () => {
    it('validates a stickies list array response', () => {
      const response = {
        stickies: [
          {
            _id: 's-1',
            content: '<p>First</p>',
            color: 'cyan-1',
            createdAt: '2026-08-17T00:00:00.000Z',
            updatedAt: '2026-08-17T00:00:00.000Z',
          },
        ],
      };
      expect(StickyListResponseSchema.safeParse(response).success).toBe(true);
    });
  });

  describe('CreateStickyPayloadSchema', () => {
    it('allows omitting optional color and title', () => {
      const payload = {
        workspaceId: 'ws-123',
        content: '<p>New Note</p>',
      };
      expect(CreateStickyPayloadSchema.safeParse(payload).success).toBe(true);
    });
  });
});
