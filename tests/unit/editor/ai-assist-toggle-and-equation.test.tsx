// @vitest-environment jsdom
/**
 * ai-assist-toggle-and-equation.test.tsx
 *
 * Verifies the AI Assist master toggle (Overleaf "Integrations → AI Assist" parity)
 * and the AI Equation Generator dialog.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createSelectionGutterActionsExtension } from '@/features/editor/core/engine/extensions/selection-gutter-actions';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { keybindingCoordinator } from '@/features/editor/subsystems/keybinding/coordinator/keybinding.coordinator';
import { EquationGeneratorModal } from '@/features/editor/subsystems/authoring-wizards/ui/EquationGeneratorModal';
import { pagesService } from '@/features/editor/sdk/pages.service';

describe('AI Assist master toggle', () => {
  const views: EditorView[] = [];

  function mountEditor(doc: string): EditorView {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({ doc, extensions: createSelectionGutterActionsExtension() }),
      parent,
    });
    views.push(view);
    return view;
  }

  beforeEach(() => {
    useSettingsStore.setState({ aiAssistEnabled: true });
  });

  afterEach(() => {
    while (views.length > 0) {
      const view = views.pop()!;
      const parent = view.dom.parentElement;
      view.destroy();
      parent?.remove();
    }
    document.body.innerHTML = '';
    cleanup();
    vi.restoreAllMocks();
  });

  it('defaults to enabled and can be toggled through the store', () => {
    expect(useSettingsStore.getState().aiAssistEnabled).toBe(true);
    useSettingsStore.getState().toggleAiAssistEnabled();
    expect(useSettingsStore.getState().aiAssistEnabled).toBe(false);
    useSettingsStore.getState().setAiAssistEnabled(true);
    expect(useSettingsStore.getState().aiAssistEnabled).toBe(true);
  });

  it('hides the AI Writing Tools button in the selection pill when disabled but keeps Comment', () => {
    useSettingsStore.setState({ aiAssistEnabled: false });
    const doc = 'Use natbib package.';
    const view = mountEditor(doc);
    const from = doc.indexOf('natbib');
    view.dispatch({ selection: EditorSelection.range(from, from + 6) });

    const commentBtn = view.dom.querySelector(
      '[data-testid="selection-gutter-comment-btn"]',
    ) as HTMLButtonElement;
    const aiBtn = view.dom.querySelector(
      '[data-testid="selection-gutter-ai-btn"]',
    ) as HTMLButtonElement;

    expect(commentBtn.hidden).toBe(false);
    expect(aiBtn.hidden).toBe(true);

    aiBtn.click();
    expect(document.querySelector('[data-testid="selection-gutter-ai-menu"]')).toBeNull();
  });

  it('shows the AI Writing Tools button again once re-enabled', () => {
    const doc = 'Use natbib package.';
    const view = mountEditor(doc);
    const from = doc.indexOf('natbib');

    useSettingsStore.setState({ aiAssistEnabled: false });
    view.dispatch({ selection: EditorSelection.range(from, from + 6) });
    const aiBtn = view.dom.querySelector(
      '[data-testid="selection-gutter-ai-btn"]',
    ) as HTMLButtonElement;
    expect(aiBtn.hidden).toBe(true);

    useSettingsStore.setState({ aiAssistEnabled: true });
    view.dispatch({ selection: EditorSelection.range(from, from + 5) });
    expect(aiBtn.hidden).toBe(false);
  });

  it('does not toggle the AI panel via Ctrl+J when AI Assist is disabled', () => {
    const dispose = keybindingCoordinator.init();
    let toggles = 0;
    const unsub = editorCommandBus.subscribe('sidebar:toggle-ai-panel', () => {
      toggles += 1;
    });

    try {
      const modKey =
        typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
          ? { metaKey: true }
          : { ctrlKey: true };

      useSettingsStore.setState({ aiAssistEnabled: false });
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true, ...modKey }));
      expect(toggles).toBe(0);

      useSettingsStore.setState({ aiAssistEnabled: true });
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true, ...modKey }));
      expect(toggles).toBe(1);
    } finally {
      unsub();
      dispose();
    }
  });
});

describe('EquationGeneratorModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('generates LaTeX from a prompt, previews it, and inserts the edited source', async () => {
    const generateSpy = vi
      .spyOn(pagesService.ai, 'generateLatexEquation')
      .mockResolvedValue('\\begin{equation}\n  E = mc^2\n\\end{equation}');
    const onInsert = vi.fn();
    const onOpenChange = vi.fn();

    render(<EquationGeneratorModal open onOpenChange={onOpenChange} onInsert={onInsert} />);

    const insertBtn = screen.getByRole('button', { name: /insert into document/i });
    expect(insertBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/describe the equation/i), {
      target: { value: 'mass energy equivalence' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith('mass energy equivalence');
    });

    const source = (await screen.findByLabelText(/generated latex source/i)) as HTMLTextAreaElement;
    expect(source.value).toContain('E = mc^2');
    expect(screen.getByTestId('equation-preview').innerHTML).toContain('katex');

    fireEvent.click(screen.getByRole('button', { name: /insert into document/i }));
    expect(onInsert).toHaveBeenCalledWith('\\begin{equation}\n  E = mc^2\n\\end{equation}\n');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps Insert disabled when the AI returns an empty equation', async () => {
    vi.spyOn(pagesService.ai, 'generateLatexEquation').mockResolvedValue('');

    render(<EquationGeneratorModal open onOpenChange={vi.fn()} onInsert={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/describe the equation/i), {
      target: { value: 'something unclear' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(pagesService.ai.generateLatexEquation).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText(/generated latex source/i)).toBeNull();
    expect(screen.getByRole('button', { name: /insert into document/i })).toBeDisabled();
  });
});
