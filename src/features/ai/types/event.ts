import type {
  EditorPatchItem,
  HitlInterrupt,
  ResponseWidget,
  SourceItem,
} from './message';

export type AiStreamEvent =
  | {
      type: 'meta';
      chatId?: string;
      title?: string;
      agent?: string;
      intent?: string;
      sources?: SourceItem[];
      widgets?: ResponseWidget[];
    }
  | {
      type: 'text-delta';
      delta: string;
    }
  | {
      type: 'reasoning-delta';
      delta: string;
    }
  | {
      type: 'agent-handoff';
      to: string;
      parallel?: boolean;
    }
  | {
      type: 'thinking';
      agent?: string;
    }
  | {
      type: 'agent-done';
      agent?: string;
      status?: 'done' | 'error';
      error?: string;
      success?: boolean;
    }
  | {
      type: 'tool-start';
      tool: string;
      agent?: string;
      input?: Record<string, unknown>;
    }
  | {
      type: 'tool-end';
      tool: string;
      agent?: string;
      status?: 'done' | 'error';
      output?: Record<string, unknown>;
      error?: string;
      success?: boolean;
      count?: number;
      action?: string;
      widgets?: ResponseWidget[];
    }
  | {
      type: 'hitl-interrupt';
      interruptId: string;
      interrupts: HitlInterrupt[];
      raw?: unknown;
    }
  | {
      type: 'editor-patch-preview';
      agent?: string;
      patch: EditorPatchItem;
      totalPatches?: number;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'done';
    };
