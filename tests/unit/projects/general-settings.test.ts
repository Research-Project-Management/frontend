import { describe, it, expect } from 'vitest';
import { projectGeneralSchema } from '@/features/projects/project-id/settings/schemas/general.schema';

describe('Scientific Project General Schema (Refined Lightweight Architecture)', () => {
  it('validates a focused scientific project with research topic, timeline and priority', () => {
    const validData = {
      name: 'Benchmark evaluation of LLMs on biomedical NLP',
      identifier: 'LLM-MED',
      description: 'Comprehensive evaluation of open and closed weights models on Vietnamese medical datasets.',
      researchField: 'Computer Science / Natural Language Processing',
      priority: 'high' as const,
      startDate: '2026-09-01',
      targetDate: '2027-08-31',
    };

    const parsed = projectGeneralSchema.parse(validData);
    expect(parsed.name).toBe('Benchmark evaluation of LLMs on biomedical NLP');
    expect(parsed.identifier).toBe('LLM-MED');
    expect(parsed.researchField).toBe('Computer Science / Natural Language Processing');
    expect(parsed.priority).toBe('high');
    expect(parsed.startDate).toBe('2026-09-01');
    expect(parsed.targetDate).toBe('2027-08-31');
  });

  it('allows minimal exploratory project without research topic or dates', () => {
    const minimalData = {
      name: 'Exploratory Lab Sandbox',
      identifier: 'SANDBOX',
      description: '',
      priority: 'none' as const,
      startDate: null,
      targetDate: null,
    };

    const parsed = projectGeneralSchema.parse(minimalData);
    expect(parsed.name).toBe('Exploratory Lab Sandbox');
    expect(parsed.identifier).toBe('SANDBOX');
    expect(parsed.researchField).toBeUndefined();
    expect(parsed.startDate).toBeNull();
    expect(parsed.targetDate).toBeNull();
  });

  it('rejects invalid identifier format with special characters', () => {
    const invalidData = {
      name: 'Invalid Project',
      identifier: 'INVALID ID!@#',
      description: '',
      priority: 'low' as const,
    };

    const result = projectGeneralSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
