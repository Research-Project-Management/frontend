// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { multiTabBus } from '@/shared/lib/multi-tab';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import { usePageStore } from '@/features/editor/core';

describe('Editor Multi-Tab Compilation Synchronization (Phân hệ 3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useCompileStore.getState().resetCompiler();
    usePageStore.setState({ projectId: 'proj-101' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useCompileStore.getState().resetCompiler();
  });

  it('broadcasts EDITOR_COMPILATION_COMPLETED when compilation succeeds', async () => {
    const broadcastSpy = vi.spyOn(multiTabBus, 'broadcast');

    // Mock compile engine returning success
    const mockEngine = {
      compile: vi.fn().mockResolvedValue({
        success: true,
        pdfUrl: 'blob:http://localhost/pdf-abc-123',
        logs: 'Output written on main.pdf',
        compiledAt: new Date(),
      }),
      cancelInFlightCompile: vi.fn(),
    };

    compilerCoordinator.setCompilerEngine(mockEngine);

    await compilerCoordinator.compile();

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EDITOR_COMPILATION_COMPLETED',
        projectId: 'proj-101',
        pdfUrl: 'blob:http://localhost/pdf-abc-123',
        status: 'success',
      }),
    );
  });

  it('rehydrates compile store in other tabs viewing the same project', () => {
    // Current tab is viewing proj-101 and is idle
    expect(useCompileStore.getState().pdfUrl).toBeNull();
    expect(useCompileStore.getState().compileStatus).toBe('idle');

    // Simulate incoming message from another tab that finished compiling proj-101
    multiTabBus.dispatchSyntheticMessageForTesting({
      type: 'EDITOR_COMPILATION_COMPLETED',
      projectId: 'proj-101',
      pdfUrl: 'blob:http://localhost/pdf-other-tab',
      status: 'success',
      timestamp: Date.now(),
      senderTabId: 'other-tab-uuidv7',
    });

    expect(useCompileStore.getState().pdfUrl).toBe('blob:http://localhost/pdf-other-tab');
    expect(useCompileStore.getState().compileStatus).toBe('done');
    expect(useCompileStore.getState().lastCompiledAt).toBeInstanceOf(Date);
  });

  it('ignores compilation broadcast for a different project', () => {
    usePageStore.setState({ projectId: 'proj-101' });
    expect(useCompileStore.getState().pdfUrl).toBeNull();

    // Message for proj-999
    multiTabBus.dispatchSyntheticMessageForTesting({
      type: 'EDITOR_COMPILATION_COMPLETED',
      projectId: 'proj-999',
      pdfUrl: 'blob:http://localhost/pdf-proj-999',
      status: 'success',
      timestamp: Date.now(),
      senderTabId: 'other-tab-uuidv7',
    });

    // Should remain untouched
    expect(useCompileStore.getState().pdfUrl).toBeNull();
    expect(useCompileStore.getState().compileStatus).toBe('idle');
  });
});
