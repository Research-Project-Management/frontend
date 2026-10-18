import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from '@/features/editor/core';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { ProjectSettingsModal } from '@/features/editor/ui/modals/project-settings/ProjectSettingsModal';

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-project-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/features/projects/shell/services/project.service', () => ({
  duplicateProjectApi: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Warning Suppression Settings & Modal Integration (Overleaf Parity)', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settingsPanelOpen: true,
      settingsActiveTab: 'editor',
      suppressBadBoxes: false,
      suppressFontWarnings: false,
      suppressPackageWarnings: false,
      customSuppressedWarnings: [],
    });
  });

  it('updates store state and adds/removes custom warning patterns', () => {
    const store = useSettingsStore.getState();

    // Toggle bad boxes
    store.setSuppressBadBoxes(true);
    expect(useSettingsStore.getState().suppressBadBoxes).toBe(true);

    // Toggle font warnings
    store.setSuppressFontWarnings(true);
    expect(useSettingsStore.getState().suppressFontWarnings).toBe(true);

    // Toggle package warnings
    store.setSuppressPackageWarnings(true);
    expect(useSettingsStore.getState().suppressPackageWarnings).toBe(true);

    // Add custom patterns
    store.addSuppressedWarning('Underfull \\hbox');
    store.addSuppressedWarning('/marginpar.*moved/i');
    expect(useSettingsStore.getState().customSuppressedWarnings).toEqual([
      'Underfull \\hbox',
      '/marginpar.*moved/i',
    ]);

    // Deduplication check
    store.addSuppressedWarning('Underfull \\hbox');
    expect(useSettingsStore.getState().customSuppressedWarnings).toHaveLength(2);

    // Remove pattern
    store.removeSuppressedWarning('Underfull \\hbox');
    expect(useSettingsStore.getState().customSuppressedWarnings).toEqual([
      '/marginpar.*moved/i',
    ]);
  });

  it('automatically syncs settings store updates to diagnosticsCoordinator filterOptions', () => {
    useSettingsStore.getState().setSuppressBadBoxes(true);
    useSettingsStore.getState().setSuppressFontWarnings(true);
    useSettingsStore.getState().addSuppressedWarning('custom-pattern');

    const options = diagnosticsCoordinator.getFilterOptions();
    expect(options.suppressBadBoxes).toBe(true);
    expect(options.suppressFontWarnings).toBe(true);
    expect(options.customPatterns).toContain('custom-pattern');
  });

  it('renders warning suppression toggles in ProjectSettingsModal and responds to user interaction', () => {
    act(() => {
      render(
        <QueryClientProvider client={queryClient}>
          <ProjectSettingsModal />
        </QueryClientProvider>
      );
    });

    // Check Bad Boxes switch
    const badBoxesSwitch = screen.getByRole('switch', { name: /hide bad boxes/i });
    expect(badBoxesSwitch).toBeInTheDocument();
    expect(badBoxesSwitch.getAttribute('aria-checked')).toBe('false');

    // Toggle it
    act(() => {
      fireEvent.click(badBoxesSwitch);
    });
    expect(useSettingsStore.getState().suppressBadBoxes).toBe(true);

    // Check Font Warnings switch
    const fontSwitch = screen.getByRole('switch', { name: /hide font warnings/i });
    expect(fontSwitch).toBeInTheDocument();
    act(() => {
      fireEvent.click(fontSwitch);
    });
    expect(useSettingsStore.getState().suppressFontWarnings).toBe(true);

    // Check Custom warning filter input
    const patternInput = screen.getByLabelText(/new warning filter pattern/i);
    expect(patternInput).toBeInTheDocument();

    act(() => {
      fireEvent.change(patternInput, { target: { value: 'Float too large' } });
      fireEvent.keyDown(patternInput, { key: 'Enter', code: 'Enter' });
    });

    expect(useSettingsStore.getState().customSuppressedWarnings).toContain('Float too large');

    // Check pattern tag is rendered
    const removeBtn = screen.getByLabelText(/remove filter Float too large/i);
    expect(removeBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(removeBtn);
    });
    expect(useSettingsStore.getState().customSuppressedWarnings).not.toContain('Float too large');
  });
});
