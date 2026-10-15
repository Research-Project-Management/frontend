/**
 * cm6-compartment-batch-reconfig.test.ts
 *
 * Unit tests for CodeMirror 6 Batched Dynamic Compartment Reconfiguration Seam (Deep Module).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createCodeMirrorPreset,
  computeCompartmentReconfigEffects,
  reconfigureEditorCompartments,
  type EditorRuntimeConfig,
} from '@/features/editor/core/engine/codemirror/codemirror-preset';

describe('CodeMirror 6 Batched Compartment Reconfiguration Seam (Deep Module)', () => {
  const viewsToCleanup: EditorView[] = [];

  afterEach(() => {
    for (const v of viewsToCleanup) {
      v.destroy();
    }
    viewsToCleanup.length = 0;
  });

  const baseConfig: EditorRuntimeConfig = {
    readOnly: false,
    lineNumbers: true,
    lineWrapping: true,
    keybinding: 'standard',
    spellCheck: true,
    spellCheckLanguage: 'en-US',
    projectId: 'proj-1',
    editorTheme: 'overleaf-light',
    fontSize: 14,
    fontFamily: 'default',
    lineHeight: 1.5,
    visualMode: false,
    errorLensEnabled: true,
  };

  function createTestView(initialDoc = '\\section{Introduction}\nHello world.'): EditorView {
    const parent = document.createElement('div');
    const state = EditorState.create({
      doc: initialDoc,
      extensions: createCodeMirrorPreset({
        readOnly: baseConfig.readOnly,
        lineNumbers: baseConfig.lineNumbers,
        lineWrapping: baseConfig.lineWrapping,
        keybinding: baseConfig.keybinding,
        enableSpellCheck: baseConfig.spellCheck,
        spellCheckLanguage: baseConfig.spellCheckLanguage,
        projectId: baseConfig.projectId,
        editorTheme: baseConfig.editorTheme,
        fontSize: baseConfig.fontSize,
        fontFamily: baseConfig.fontFamily,
        lineHeight: baseConfig.lineHeight,
        enableVisualMode: baseConfig.visualMode,
        enableErrorLens: baseConfig.errorLensEnabled,
      }),
    });
    const view = new EditorView({ state, parent });
    viewsToCleanup.push(view);
    return view;
  }

  it('returns 0 effects and dispatches 0 transactions when runtime config is unchanged', () => {
    const view = createTestView();
    const dispatchSpy = vi.spyOn(view, 'dispatch');

    const effects = computeCompartmentReconfigEffects(baseConfig, { ...baseConfig });
    expect(effects).toHaveLength(0);

    const dispatchedCount = reconfigureEditorCompartments(view, baseConfig, { ...baseConfig });
    expect(dispatchedCount).toBe(0);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('batches multiple simultaneous setting changes into a single atomic view.dispatch transaction', () => {
    const view = createTestView('\\documentclass{article}\n\\begin{document}\nBatch test\n\\end{document}');
    const dispatchSpy = vi.spyOn(view, 'dispatch');

    const nextConfig: EditorRuntimeConfig = {
      ...baseConfig,
      fontSize: 18,
      fontFamily: 'jetbrains',
      editorTheme: 'monokai',
      lineWrapping: false,
      readOnly: true,
      keybinding: 'emacs',
    };

    const effectCount = reconfigureEditorCompartments(view, baseConfig, nextConfig);

    // 5 compartments changed: readOnly, lineWrapping, keybinding, editorTheme, typography
    expect(effectCount).toBe(5);
    // All 5 compartment reconfigurations must be committed in EXACTLY 1 transaction
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(view.state.readOnly).toBe(true);
    expect(view.state.doc.toString()).toContain('Batch test');
  });

  it('preserves user lineNumbers=false preference when entering and exiting visualMode', () => {
    const userNoLinesConfig: EditorRuntimeConfig = {
      ...baseConfig,
      lineNumbers: false,
      visualMode: false,
    };

    const enterVisualConfig: EditorRuntimeConfig = {
      ...userNoLinesConfig,
      visualMode: true,
    };

    // Entering visualMode when lineNumbers is already false: only visualMode compartment needs reconfiguring
    const enterEffects = computeCompartmentReconfigEffects(userNoLinesConfig, enterVisualConfig);
    expect(enterEffects).toHaveLength(1);

    // Exiting visualMode when user preference lineNumbers is false: only visualMode compartment reconfigures,
    // lineNumbers stays false (not clobbered back to true)
    const exitEffects = computeCompartmentReconfigEffects(enterVisualConfig, userNoLinesConfig);
    expect(exitEffects).toHaveLength(1);
  });

  it('toggles both visualMode and lineNumbers compartments atomically when lineNumbers=true', () => {
    const view = createTestView();
    const dispatchSpy = vi.spyOn(view, 'dispatch');

    const visualConfig: EditorRuntimeConfig = {
      ...baseConfig,
      lineNumbers: true,
      visualMode: true,
    };

    // Entering visual mode with lineNumbers=true hides lineNumbers and activates visual widgets in 1 batch
    const enterCount = reconfigureEditorCompartments(view, baseConfig, visualConfig);
    expect(enterCount).toBe(2);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    // Exiting visual mode restores lineNumbers and deactivates visual widgets in 1 batch
    const exitCount = reconfigureEditorCompartments(view, visualConfig, baseConfig);
    expect(exitCount).toBe(2);
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
  });
});
