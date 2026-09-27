import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '@/shared/lib/api';
import {
  transferOwnershipApi,
  ProjectService,
} from '@/features/projects/shell/services/project.service';

describe('Project Ownership Transfer (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /api/projects/:projectId/transfer-ownership with designated newOwnerId', async () => {
    const mockResponse = {
      message: 'Project ownership transferred successfully',
      previousOwner: { userId: 'user-owner', role: 'coordinator' },
      newOwner: { userId: 'user-collaborator', role: 'owner' },
    };

    const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce(mockResponse as any);

    const result = await transferOwnershipApi('proj-123', 'user-collaborator');

    expect(apiPostSpy).toHaveBeenCalledWith(
      '/api/projects/proj-123/transfer-ownership',
      { newOwnerId: 'user-collaborator' },
    );
    expect(result.message).toBe('Project ownership transferred successfully');
    expect(result.newOwner.role).toBe('owner');
    expect(result.previousOwner.role).toBe('coordinator');
  });

  it('is accessible via ProjectService.transferOwnership', async () => {
    const mockResponse = {
      message: 'Project ownership transferred successfully',
      previousOwner: { userId: 'user-1', role: 'coordinator' },
      newOwner: { userId: 'user-2', role: 'owner' },
    };

    const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce(mockResponse as any);

    const result = await ProjectService.transferOwnership('proj-456', 'user-2');

    expect(apiPostSpy).toHaveBeenCalledWith(
      '/api/projects/proj-456/transfer-ownership',
      { newOwnerId: 'user-2' },
    );
    expect(result.newOwner.userId).toBe('user-2');
  });
});
