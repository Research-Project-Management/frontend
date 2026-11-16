import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelService } from '@/features/projects/project-id/settings/services/label.service';
import * as apiModule from '@/shared/lib/api';
import type { Label } from '@/features/projects/project-id/settings/types/label.types';

describe('Project Labels Multi-Tab Segmentation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls /api/projects/:projectId/labels without query when type is omitted', async () => {
    const apiGetSpy = vi.spyOn(apiModule, 'apiGet').mockResolvedValue({
      labels: [
        { id: '1', name: 'Bug', color: '#ef4444', type: 'work_item' },
        { id: '2', name: 'Survey', color: '#10b981', type: 'library' },
      ],
    });

    const labels = await LabelService.getProjectLabels('proj-123');
    expect(apiGetSpy).toHaveBeenCalledWith('/api/projects/proj-123/labels');
    expect(labels).toHaveLength(2);
  });

  it('calls /api/projects/:projectId/labels?type=work_item when type is specified', async () => {
    const apiGetSpy = vi.spyOn(apiModule, 'apiGet').mockResolvedValue({
      labels: [{ id: '1', name: 'Deep Learning', color: '#3b82f6', type: 'work_item' }],
    });

    const labels = await LabelService.getProjectLabels('proj-123', 'work_item');
    expect(apiGetSpy).toHaveBeenCalledWith('/api/projects/proj-123/labels?type=work_item');
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('Deep Learning');
  });

  it('correctly partitions labels into work_item, library, and page buckets', () => {
    const mockLabels: Label[] = [
      { id: '1', name: 'Bug', color: '#ef4444', type: 'work_item' },
      { id: '2', name: 'Optimization', color: '#06b6d4', type: 'work_item' },
      { id: '3', name: 'BibTeX', color: '#ec4899', type: 'library' },
      { id: '4', name: 'Draft', color: '#10b981', type: 'page' },
      { id: '5', name: 'Peer Review', color: '#f97316', type: 'page' },
    ];

    const workItems = mockLabels.filter((l) => (l.type || 'work_item') === 'work_item');
    const library = mockLabels.filter((l) => l.type === 'library');
    const pages = mockLabels.filter((l) => l.type === 'page');

    expect(workItems).toHaveLength(2);
    expect(library).toHaveLength(1);
    expect(pages).toHaveLength(2);
  });

  it('submits label creation with specific subsystem type', async () => {
    const apiPostSpy = vi.spyOn(apiModule, 'apiPost').mockResolvedValue({
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
