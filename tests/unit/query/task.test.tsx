import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectTasks } from '~/query/task';
import * as api from '~/lib/api';
import React from 'react';

// Mock dependencies
vi.mock('~/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('~/contexts/SocketProvider', () => ({
  useSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() })),
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('task queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useProjectTasks', () => {
    it('fetches project tasks successfully', async () => {
      const mockData = {
        tasks: [{ _id: 'task-1', title: 'Test Task' }],
        columns: [{ _id: 'col-1', name: 'To Do' }],
        projectName: 'Test Project',
        cycles: []
      };

      (api.apiGet as any).mockResolvedValue(mockData);

      const { result } = renderHook(() => useProjectTasks('project-123'), {
        wrapper: createWrapper()
      });

      // Initially isLoading is true
      expect(result.current.isLoading).toBe(true);

      // Wait for the query to resolve
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.apiGet).toHaveBeenCalledWith('/api/project/project-123/tasks');
      expect(result.current.data).toEqual(mockData);
    });

    it('fetches with cycleId when provided', async () => {
      (api.apiGet as any).mockResolvedValue({ tasks: [], columns: [] });

      const { result } = renderHook(() => useProjectTasks('project-123', 'cycle-456'), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.apiGet).toHaveBeenCalledWith('/api/project/project-123/tasks?cycle=cycle-456');
    });

    it('handles api error correctly', async () => {
      (api.apiGet as any).mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useProjectTasks('project-error'), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Network Error');
    });
  });
});
