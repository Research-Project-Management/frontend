import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { WorkbenchShell } from '@/features/editor/core/shell/WorkbenchShell';
import { useWorkspaceStore } from '@/features/editor/core';

describe('WorkbenchShell ResizeHandle interactions & logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    useWorkspaceStore.setState({
      sidebarLeftOpen: true,
      sidebarLeftWidth: 260,
      splitRatio: 0.5,
    });
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('tracks pointer 1:1 across multiple mousemove frames without exponential runaway', () => {
    render(
      <WorkbenchShell
        leftSidebar={<div>Sidebar</div>}
        editor={<div>Editor</div>}
        preview={<div>Preview</div>}
      />,
    );

    const handle = screen.getByRole('separator', {
      name: /resize or collapse left sidebar/i,
    });

    fireEvent.mouseDown(handle, { clientX: 260, button: 0 });
    fireEvent.mouseMove(window, { clientX: 280 });
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(280);

    fireEvent.mouseMove(window, { clientX: 300 });
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(300);

    fireEvent.mouseMove(window, { clientX: 250 });
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(250);

    fireEvent.mouseUp(window);
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('collapses on quick pill click (< 4px move) and expands when clicking collapsed rail or pill', () => {
    render(
      <WorkbenchShell
        leftSidebar={<div>Sidebar</div>}
        editor={<div>Editor</div>}
        preview={<div>Preview</div>}
      />,
    );

    const leftHandle = screen.getByRole('separator', {
      name: /resize or collapse left sidebar/i,
    });
    const collapseBtn = within(leftHandle).getByRole('button', { name: /collapse panel/i });
    fireEvent.mouseDown(collapseBtn, { clientX: 260, button: 0 });
    fireEvent.mouseMove(window, { clientX: 262 });
    fireEvent.mouseUp(window);
    fireEvent.click(collapseBtn);

    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(false);

    // Click anywhere on the collapsed rail -> expands
    const collapsedRail = screen.getByRole('separator', {
      name: /expand left sidebar/i,
    });
    fireEvent.click(collapsedRail);
    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);

    // Collapse again, then click specifically on the Expand button -> must not double-toggle
    const reopenedLeftHandle = screen.getByRole('separator', {
      name: /resize or collapse left sidebar/i,
    });
    fireEvent.click(within(reopenedLeftHandle).getByRole('button', { name: /collapse panel/i }));
    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(false);

    const recollapsedRail = screen.getByRole('separator', {
      name: /expand left sidebar/i,
    });
    fireEvent.click(within(recollapsedRail).getByRole('button', { name: /expand panel/i }));
    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
  });

  it('resizes smoothly when dragging >= 4px from the collapse pill without collapsing on release click', () => {
    vi.useFakeTimers();

    render(
      <WorkbenchShell
        leftSidebar={<div>Sidebar</div>}
        editor={<div>Editor</div>}
        preview={<div>Preview</div>}
      />,
    );

    const leftHandle = screen.getByRole('separator', {
      name: /resize or collapse left sidebar/i,
    });
    const collapseBtn = within(leftHandle).getByRole('button', { name: /collapse panel/i });
    fireEvent.mouseDown(collapseBtn, { clientX: 260, button: 0 });
    fireEvent.mouseMove(window, { clientX: 295 });
    fireEvent.mouseUp(window);
    fireEvent.click(collapseBtn);

    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();

    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(295);
  });

  it('resets left sidebar width to 260px and opens sidebar on double-click of the rail', () => {
    useWorkspaceStore.setState({ sidebarLeftWidth: 390 });

    render(
      <WorkbenchShell
        leftSidebar={<div>Sidebar</div>}
        editor={<div>Editor</div>}
        preview={<div>Preview</div>}
      />,
    );

    const handle = screen.getByRole('separator', {
      name: /resize or collapse left sidebar/i,
    });
    fireEvent.doubleClick(handle);

    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(260);
  });

  it('supports keyboard ArrowRight, ArrowLeft, Home, End, and Enter on both splitters', () => {
    render(
      <WorkbenchShell
        leftSidebar={<div>Sidebar</div>}
        editor={<div>Editor</div>}
        preview={<div>Preview</div>}
      />,
    );

    const leftHandle = screen.getByRole('separator', {
      name: /resize or collapse left sidebar/i,
    });
    fireEvent.keyDown(leftHandle, { key: 'ArrowRight' });
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(276);

    fireEvent.keyDown(leftHandle, { key: 'ArrowLeft', shiftKey: true });
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(228);

    fireEvent.keyDown(leftHandle, { key: 'Home' });
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(180);

    fireEvent.keyDown(leftHandle, { key: 'End' });
    expect(useWorkspaceStore.getState().sidebarLeftWidth).toBe(480);

    fireEvent.keyDown(leftHandle, { key: 'Enter' });
    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(false);

    // Pressing ArrowRight on collapsed sidebar rail reopens it
    const collapsedLeft = screen.getByRole('separator', {
      name: /expand left sidebar/i,
    });
    fireEvent.keyDown(collapsedLeft, { key: 'ArrowRight' });
    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);

    // Center editor/preview splitter keyboard controls
    const centerHandle = screen.getByRole('separator', {
      name: /resize or collapse pdf preview/i,
    });
    fireEvent.keyDown(centerHandle, { key: 'ArrowRight' });
    expect(useWorkspaceStore.getState().splitRatio).toBeCloseTo(0.53, 5);

    fireEvent.keyDown(centerHandle, { key: 'ArrowLeft', shiftKey: true });
    expect(useWorkspaceStore.getState().splitRatio).toBeCloseTo(0.45, 5);

    fireEvent.keyDown(centerHandle, { key: 'Home' });
    expect(useWorkspaceStore.getState().splitRatio).toBe(0.15);

    fireEvent.keyDown(centerHandle, { key: 'End' });
    expect(useWorkspaceStore.getState().splitRatio).toBe(0.85);

    fireEvent.keyDown(centerHandle, { key: 'Enter' });
    expect(
      screen.getByRole('separator', { name: /expand pdf preview/i }),
    ).toBeInTheDocument();

    // ArrowLeft reopens collapsed preview
    fireEvent.keyDown(
      screen.getByRole('separator', { name: /expand pdf preview/i }),
      { key: 'ArrowLeft' },
    );
    expect(
      screen.getByRole('separator', { name: /resize or collapse pdf preview/i }),
    ).toBeInTheDocument();
  });
});
