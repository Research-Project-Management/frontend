import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveEffectiveLibraryPermissions, PROJECT_ROLE_PERMISSIONS, getLibraryPermissions, } from '@/features/library/domain/library-permissions.policy';
import { duplicateGroupSchema } from '@/features/library/domain/types/curation.types';
import { QualityService, CitationService, fetchReferenceByDoi, sanitizeItemPayload } from '@/features/library/sdk/library.client';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { resolveProjectRole } from '@/features/library/ui/sidebar/ProjectLibrariesSection';
import * as api from '@/shared/lib/api';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('Wave 14: Backend-Authority Alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Wave A: Authorization & Security Boundary Cleanup', () => {
    it('strips RBAC role, permissions, and effectivePermissions from activeScope when persisting to localStorage', () => {
      const store = useLibraryUIStore.getState();

      store.setActiveScope({
        type: 'project',
        id: 'project:proj-123',
        name: 'Quantum Gravity Lab',
        projectId: 'proj-123',
        role: 'owner',
        permissions: {
          canRead: true,
          canCreateItem: true,
          canEditItem: true,
          canDeleteItem: true,
          canPurgeItem: true,
          canManageCollections: true,
          canImport: true,
          canExport: true,
        },
        effectivePermissions: ['library:read', 'library:delete', 'library:purge'],
      });

      const persistedRaw = localStorage.getItem('flux_library_sidebar_v1');
      expect(persistedRaw).toBeTruthy();

      const persisted = JSON.parse(persistedRaw!);
      expect(persisted.state.activeScope).toEqual({
        type: 'project',
        id: 'project:proj-123',
        name: 'Quantum Gravity Lab',
        projectId: 'proj-123',
      });
      expect(persisted.state.activeScope.role).toBeUndefined();
      expect(persisted.state.activeScope.permissions).toBeUndefined();
      expect(persisted.state.activeScope.effectivePermissions).toBeUndefined();
    });

    it('enforces owner-only canPurgeItem in PROJECT_ROLE_PERMISSIONS while coordinator can delete (trash) but not purge', () => {
      expect(PROJECT_ROLE_PERMISSIONS.owner.canDeleteItem).toBe(true);
      expect(PROJECT_ROLE_PERMISSIONS.owner.canPurgeItem).toBe(true);

      expect(PROJECT_ROLE_PERMISSIONS.coordinator.canDeleteItem).toBe(true);
      expect(PROJECT_ROLE_PERMISSIONS.coordinator.canPurgeItem).toBe(false);

      expect(PROJECT_ROLE_PERMISSIONS.contributor.canDeleteItem).toBe(false);
      expect(PROJECT_ROLE_PERMISSIONS.contributor.canPurgeItem).toBe(false);

      expect(PROJECT_ROLE_PERMISSIONS.reviewer.canDeleteItem).toBe(false);
      expect(PROJECT_ROLE_PERMISSIONS.reviewer.canPurgeItem).toBe(false);
    });

    it('prioritizes Backend-returned permissions, effectivePermissions, and permissionOverrides in resolveEffectiveLibraryPermissions', () => {
      // Contributor with explicit backend permission override granting library:delete
      const contributorWithDeleteOverride = resolveEffectiveLibraryPermissions({
        scopeType: 'project',
        role: 'contributor',
        effectivePermissions: ['library:read', 'library:create', 'library:edit', 'library:delete', 'library:import', 'library:export'],
      });

      expect(contributorWithDeleteOverride.canDeleteItem).toBe(true);
      expect(contributorWithDeleteOverride.canPurgeItem).toBe(false);

      // Reviewer with explicit backend permission object override
      const reviewerWithEditOverride = resolveEffectiveLibraryPermissions({
        scopeType: 'project',
        role: 'reviewer',
        permissions: {
          canEditItem: true,
        },
      });

      expect(reviewerWithEditOverride.canRead).toBe(true);
      expect(reviewerWithEditOverride.canEditItem).toBe(true);
      expect(reviewerWithEditOverride.canDeleteItem).toBe(false);
      expect(reviewerWithEditOverride.canPurgeItem).toBe(false);

      // Fail-closed read-only fallback when role is absent on project scope
      const unknownProjectRole = resolveEffectiveLibraryPermissions({
        scopeType: 'project',
        role: undefined,
      });

      expect(unknownProjectRole.canRead).toBe(true);
      expect(unknownProjectRole.canCreateItem).toBe(false);
      expect(unknownProjectRole.canEditItem).toBe(false);
      expect(unknownProjectRole.canDeleteItem).toBe(false);
      expect(unknownProjectRole.canPurgeItem).toBe(false);
    });

    it('keeps getLibraryPermissions backward-compatible while honoring backend overrides on scope', () => {
      const perms = getLibraryPermissions({
        type: 'project',
        id: 'project:p1',
        name: 'Project 1',
        projectId: 'p1',
        role: 'contributor',
        effectivePermissions: ['library:read', 'library:delete'],
      });

      expect(perms.canRead).toBe(true);
      expect(perms.canDeleteItem).toBe(true);
    });

    it('sanitizeItemPayload strips client-internal underscore keys and functions without hardcoded security blocklists', () => {
      const sanitized = sanitizeItemPayload({
        title: 'Clean Architecture',
        itemType: 'book',
        _optimisticId: 'temp-1',
        _uiState: 'dirty',
        onClick: () => {},
      });

      expect(sanitized).toEqual({
        title: 'Clean Architecture',
        itemType: 'book',
      });
    });

    it('resolveProjectRole reads Backend yourRole/role directly and ignores client-side ownerId/createdById/members[] heuristics', () => {
      expect(
        resolveProjectRole(
          {
            id: 'proj-1',
            ownerId: 'user-123',
            createdById: 'user-123',
            members: [{ userId: 'user-123', role: 'owner' }],
          },
          'user-123',
        ),
      ).toBe('reviewer');

      expect(
        resolveProjectRole(
          {
            id: 'proj-1',
            yourRole: 'coordinator',
            ownerId: 'user-123',
          },
          'user-123',
        ),
      ).toBe('coordinator');
    });
  });

  describe('Wave B: Citation & Export Authority Cleanup', () => {
    it('forwards raw DOI/identifier directly to POST /api/v1/library/citation/resolve without client-side regex pre-cleaning', async () => {
      vi.mocked(api.apiPost).mockResolvedValueOnce({
        data: {
          id: 'item-doi-1',
          title: 'Attention Is All You Need',
          authors: ['Vaswani et al.'],
          year: 2017,
          doi: '10.48550/arXiv.1706.03762',
          citationKey: 'vaswani2017attention',
        },
      });

      const rawInput = 'https://doi.org/10.48550/arXiv.1706.03762';
      const result = await fetchReferenceByDoi(rawInput);

      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/v1/library/citation/resolve',
        { doi: rawInput, query: rawInput },
        { silent: true },
      );
      expect(result?.title).toBe('Attention Is All You Need');
      expect(result?.doi).toBe('10.48550/arXiv.1706.03762');
    });

    it('CitationService.resolve delegates directly to Backend /api/v1/library/citation/resolve', async () => {
      vi.mocked(api.apiPost).mockResolvedValueOnce({
        data: {
          title: 'Deep Residual Learning',
          authors: ['Kaiming He'],
          year: 2016,
          doi: '10.1109/CVPR.2016.90',
        },
      });

      const resolved = await CitationService.resolve('doi:10.1109/CVPR.2016.90');
      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/v1/library/citation/resolve',
        { query: 'doi:10.1109/CVPR.2016.90' },
        { silent: true },
      );
      expect(resolved?.title).toBe('Deep Residual Learning');
    });
  });

  describe('Wave C: Duplicate Detection, Master Selection & N+1 Elimination', () => {
    it('preserves recommendedMasterId and full item metadata in QualityService.getDuplicates and duplicateGroupSchema', async () => {
      const backendDuplicatePayload = [
        {
          clusterId: 'dup-group-1',
          confidence: 0.99,
          matchReason: 'EXACT_DOI',
          recommendedMasterId: 'item-rich-master',
          items: [
            {
              id: 'item-sparse',
              title: 'Neural Scaling Laws',
              authors: ['Kaplan'],
              year: 2020,
              updatedAt: '2026-03-01T10:00:00Z',
            },
            {
              id: 'item-rich-master',
              title: 'Scaling Laws for Neural Language Models',
              authors: ['Jared Kaplan', 'Sam McCandlish'],
              year: 2020,
              doi: '10.48550/arXiv.2001.08361',
              abstract: 'We study empirical scaling laws for language model performance on the cross-entropy loss.',
              journal: 'arXiv',
              tags: [{ id: 't1', name: 'scaling' }],
              attachments: [{ id: 'att-1', filename: 'paper.pdf' }],
              updatedAt: '2026-02-01T10:00:00Z',
            },
          ],
        },
      ];

      vi.mocked(api.apiGet).mockResolvedValueOnce({
        data: backendDuplicatePayload,
      });

      const response = await QualityService.getDuplicates('user');
      const groups = response.duplicateGroups;

      expect(groups).toHaveLength(1);
      expect(groups[0].recommendedMasterId).toBe('item-rich-master');
      expect(groups[0].items).toHaveLength(2);
      expect((groups[0].items?.[1] as Record<string, unknown>).abstract).toBe(
        'We study empirical scaling laws for language model performance on the cross-entropy loss.',
      );
      expect((groups[0].items?.[1] as Record<string, unknown>).journal).toBe('arXiv');

      // Validate schema parsing preserves recommendedMasterId
      const parsed = duplicateGroupSchema.parse(groups[0]);
      expect(parsed.recommendedMasterId).toBe('item-rich-master');
    });
  });
});



