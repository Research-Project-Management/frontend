import { describe, it, expect } from 'vitest';
import {
  createCommentSchema,
  createReplySchema,
} from '@/features/editor/schemas/comment.schema';
import {
  createFileSchema,
  createFolderSchema,
  renameItemSchema,
  createSnapshotSchema,
} from '@/features/editor/schemas/document.schema';

describe('Editor Schemas Integration & Validation', () => {
  describe('createCommentSchema', () => {
    it('should validate a valid comment with line and lineEnd numbers', () => {
      const valid = {
        content: 'Consider citing Vaswani et al. (2017) here.',
        line: 42,
        lineEnd: 45,
      };

      const result = createCommentSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Consider citing Vaswani et al. (2017) here.');
        expect(result.data.line).toBe(42);
        expect(result.data.lineEnd).toBe(45);
      }
    });

    it('should accept comments with null or omitted line numbers', () => {
      const generalComment = {
        content: 'Overall paper structure looks great.',
        line: null,
        lineEnd: null,
      };

      const result = createCommentSchema.safeParse(generalComment);
      expect(result.success).toBe(true);

      const minimalComment = {
        content: 'Minimal feedback without line bounds.',
      };
      expect(createCommentSchema.safeParse(minimalComment).success).toBe(true);
    });

    it('should reject empty or whitespace-only comment content', () => {
      const empty = {
        content: '   ',
        line: 1,
      };

      const result = createCommentSchema.safeParse(empty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Comment cannot be empty');
      }
    });

    it('should reject comments exceeding 5000 characters', () => {
      const tooLong = {
        content: 'a'.repeat(5001),
      };

      const result = createCommentSchema.safeParse(tooLong);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Comment is too long');
      }
    });

    it('should reject non-positive or float line numbers', () => {
      expect(createCommentSchema.safeParse({ content: 'Test', line: 0 }).success).toBe(false);
      expect(createCommentSchema.safeParse({ content: 'Test', line: -1 }).success).toBe(false);
      expect(createCommentSchema.safeParse({ content: 'Test', line: 1.5 }).success).toBe(false);
    });
  });

  describe('createReplySchema', () => {
    it('should validate a valid reply', () => {
      const valid = {
        content: 'Addressed in commit 3a4f8c.',
      };

      const result = createReplySchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Addressed in commit 3a4f8c.');
      }
    });

    it('should reject empty or whitespace-only reply', () => {
      const empty = { content: '    ' };
      const result = createReplySchema.safeParse(empty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Reply cannot be empty');
      }
    });

    it('should reject reply exceeding 2000 characters', () => {
      const tooLong = { content: 'b'.repeat(2001) };
      const result = createReplySchema.safeParse(tooLong);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Reply is too long');
      }
    });
  });

  describe('createFileSchema', () => {
    it('should validate a valid LaTeX filename with optional content', () => {
      const valid = {
        title: 'methodology.tex',
        content: '\\section{Methodology}\nProposed method description.',
      };

      const result = createFileSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('methodology.tex');
        expect(result.data.content).toContain('Methodology');
      }
    });

    it('should reject empty or whitespace-only file title', () => {
      const empty = { title: '   ' };
      const result = createFileSchema.safeParse(empty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('File name is required');
      }
    });

    it('should reject filenames with backslashes', () => {
      const invalid = { title: 'invalid\\path\\name.tex' };
      const result = createFileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Backslashes are not allowed in file names');
      }
    });

    it('should reject filenames exceeding 255 characters', () => {
      const tooLong = { title: 'f'.repeat(256) };
      const result = createFileSchema.safeParse(tooLong);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('File name is too long');
      }
    });
  });

  describe('createFolderSchema', () => {
    it('should validate a valid folder name', () => {
      const valid = { name: 'sections' };
      const result = createFolderSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('sections');
      }
    });

    it('should reject empty or whitespace-only folder name', () => {
      const empty = { name: '   ' };
      const result = createFolderSchema.safeParse(empty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Folder name is required');
      }
    });

    it('should reject folder name exceeding 255 characters', () => {
      const tooLong = { name: 'd'.repeat(256) };
      const result = createFolderSchema.safeParse(tooLong);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Folder name is too long');
      }
    });
  });

  describe('renameItemSchema', () => {
    it('should validate a valid item rename', () => {
      const valid = { name: 'conclusion_v2.tex' };
      const result = renameItemSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('conclusion_v2.tex');
      }
    });

    it('should reject empty or whitespace-only rename name', () => {
      const empty = { name: '   ' };
      const result = renameItemSchema.safeParse(empty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Name is required');
      }
    });

    it('should reject name exceeding 255 characters', () => {
      const tooLong = { name: 'r'.repeat(256) };
      const result = renameItemSchema.safeParse(tooLong);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Name is too long');
      }
    });
  });

  describe('createSnapshotSchema', () => {
    it('should validate a snapshot with a valid label', () => {
      const valid = { label: 'Before major refactor of section 2' };
      const result = createSnapshotSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe('Before major refactor of section 2');
      }
    });

    it('should accept snapshot with empty or omitted label', () => {
      expect(createSnapshotSchema.safeParse({}).success).toBe(true);
      expect(createSnapshotSchema.safeParse({ label: '' }).success).toBe(true);
      expect(createSnapshotSchema.safeParse({ label: undefined }).success).toBe(true);
    });

    it('should reject snapshot label exceeding 100 characters', () => {
      const tooLong = { label: 's'.repeat(101) };
      const result = createSnapshotSchema.safeParse(tooLong);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Label too long');
      }
    });
  });
});
