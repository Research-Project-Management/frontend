import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '@/shared/lib/api';
import { projectGeneralSchema } from '@/features/projects/project-id/settings/schemas/general.schema';
import { LabelService } from '@/features/projects/project-id/settings/services/label.service';
import {
  transferOwnershipApi,
  ProjectService,
} from '@/features/projects/shell/services/project.service';

describe('Project Settings, Labels Segmentation & Ownership Transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Project General Schema', () => {
    it('validates scientific projects with optional research field/dates and rejects invalid identifiers', () => {
      const fullParsed = projectGeneralSchema.parse({
        name: 'Benchmark evaluation of LLMs on biomedical NLP',
        identifier: 'LLM-MED',
        description: 'Comprehensive evaluation on Vietnamese medical datasets.',
        researchField: 'Computer Science / Natural Language Processing',
        priority: 'high' as const,
        startDate: '2026-09-01',
        targetDate: '2027-08-31',
      });
      expect(fullParsed.identifier).toBe('LLM-MED');
      expect(fullParsed.researchField).toBe('Computer Science / Natural Language Processing');
      expect(fullParsed.priority).toBe('high');

      const minimalParsed = projectGeneralSchema.parse({
        name: 'Exploratory Lab Sandbox',
        identifier: 'SANDBOX',
        description: '',
        priority: 'none' as const,
        startDate: null,
        targetDate: null,
      });
      expect(minimalParsed.researchField).toBeUndefined();
      expect(minimalParsed.startDate).toBeNull();

      const invalid = projectGeneralSchema.safeParse({
        name: 'Invalid Project',
        identifier: 'INVALID ID!@#',
        description: '',
        priority: 'low' as const,
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('LabelService Subsystem Segmentation', () => {
    it('queries /api/projects/:projectId/labels with optional type filter and creates typed labels', async () => {
      const apiGetSpy = vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        labels: [
          { id: '1', name: 'Bug', color: '#ef4444', type: 'work_item' },
          { id: '2', name: 'Survey', color: '#10b981', type: 'library' },
        ],
      });

      const allLabels = await LabelService.getProjectLabels('proj-123');
      expect(apiGetSpy).toHaveBeenCalledWith('/api/projects/proj-123/labels');
      expect(allLabels).toHaveLength(2);

      apiGetSpy.mockResolvedValueOnce({
        labels: [{ id: '1', name: 'Deep Learning', color: '#3b82f6', type: 'work_item' }],
      });
      const filtered = await LabelService.getProjectLabels('proj-123', 'work_item');
      expect(apiGetSpy).toHaveBeenCalledWith('/api/projects/proj-123/labels?type=work_item');
      expect(filtered[0].name).toBe('Deep Learning');

      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        label: {
          id: 'new-id',
          name: 'Benchmark Dataset',
          color: '#8b5cf6',
          type: 'library',
        },
      });
      const created = await LabelService.createProjectLabel('proj-123', {
        name: 'Benchmark Dataset',
        color: '#8b5cf6',
        type: 'library',
      });
      expect(apiPostSpy).toHaveBeenCalledWith('/api/projects/proj-123/labels', {
        name: 'Benchmark Dataset',
        color: '#8b5cf6',
        type: 'library',
      });
      expect(created.type).toBe('library');
    });
  });

  describe('Project Ownership Transfer', () => {
    it('posts newOwnerId to /api/projects/:projectId/transfer-ownership via API and ProjectService', async () => {
      const mockResponse = {
        message: 'Project ownership transferred successfully',
        previousOwner: { userId: 'user-owner', role: 'coordinator' },
        newOwner: { userId: 'user-collaborator', role: 'owner' },
      };

      const apiPostSpy = vi
        .spyOn(api, 'apiPost')
        .mockResolvedValue(mockResponse as never);

      const directRes = await transferOwnershipApi('proj-123', 'user-collaborator');
      expect(apiPostSpy).toHaveBeenCalledWith(
        '/api/projects/proj-123/transfer-ownership',
        { newOwnerId: 'user-collaborator' },
      );
      expect(directRes.newOwner.role).toBe('owner');
      expect(directRes.previousOwner.role).toBe('coordinator');

      const serviceRes = await ProjectService.transferOwnership('proj-456', 'user-collaborator');
      expect(apiPostSpy).toHaveBeenCalledWith(
        '/api/projects/proj-456/transfer-ownership',
        { newOwnerId: 'user-collaborator' },
      );
      expect(serviceRes.newOwner.userId).toBe('user-collaborator');
    });
  });
});
