/**
 * yjs-codemirror-adapter.ts
 *
 * Seam & Adapter between Yjs CRDT (State Layer) and CodeMirror 6 (Engines Layer).
 *
 * Conforms to ADR-0002 & yjs-best-practices:
 * - Dynamically binds a Y.Text instance to CodeMirror EditorView via yCollab.
 * - Manages Awareness protocol for collaborator cursor colors and name tags.
 * - Provides compartment-based dynamic hot-swapping when active files change.
 */

import { Compartment, type Extension } from '@codemirror/state';
import { yCollab } from 'y-codemirror.next';
import type * as Y from 'yjs';

export interface YjsCollabOptions {
  yText: Y.Text | null;
  awareness?: any | null;
  undoManager?: Y.UndoManager | false;
}

export class YjsCodeMirrorAdapter {
  private compartment = new Compartment();

  /**
   * Returns the initial compartment extension to register in EditorState.
   */
  public getExtension(options: YjsCollabOptions): Extension {
    return this.compartment.of(this.buildExtension(options));
  }

  /**
   * Generates reconfiguration effect for hot-swapping documents or awareness.
   */
  public reconfigure(options: YjsCollabOptions) {
    return this.compartment.reconfigure(this.buildExtension(options));
  }

  private buildExtension(options: YjsCollabOptions): Extension[] {
    const { yText, awareness, undoManager } = options;

    if (!yText) {
      return [];
    }

    const collabOptions = undoManager !== undefined ? { undoManager } : undefined;

    if (awareness) {
      return [
        yCollab(yText, awareness, collabOptions),
      ];
    }

    return [
      yCollab(yText, null, collabOptions),
    ];
  }
}
