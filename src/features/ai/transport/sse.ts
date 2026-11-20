import type { AiStreamEvent } from '../types/event';
import type {
  EditorPatchItem,
  HitlInterrupt,
  ResponseWidget,
  SourceItem,
} from '../types/message';
import { logger } from '@/shared/lib/logger';

export interface RawSseFrame {
  event: string;
  data: string;
}

function unescapeNewlines(text: string): string {
  return text.includes('\\n') ? text.replace(/\\r\\n|\\n/g, '\n') : text;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeHitlInterrupts(
  action: Record<string, unknown>,
): HitlInterrupt[] {
  const input = asRecord(action.input);
  const rawInterrupts = Array.isArray(input?.interrupts)
    ? input.interrupts
    : Array.isArray(action.interrupts)
      ? action.interrupts
      : [];

  if (rawInterrupts.length > 0) {
    return rawInterrupts.map((entry, idx) => {
      const rec = asRecord(entry) ?? {};
      const nestedActionRequests = Array.isArray(rec.action_requests)
        ? rec.action_requests
        : null;
      const firstReq = nestedActionRequests
        ? asRecord(nestedActionRequests[0])
        : null;

      const tool =
        (typeof rec.tool === 'string' && rec.tool) ||
        (typeof rec.name === 'string' && rec.name) ||
        (typeof firstReq?.name === 'string' && firstReq.name) ||
        (typeof action.tool === 'string' && action.tool) ||
        undefined;

      const args =
        asRecord(rec.args) ||
        asRecord(rec.arguments) ||
        asRecord(firstReq?.args) ||
        asRecord(firstReq?.arguments) ||
        undefined;

      const description =
        (typeof rec.description === 'string' && rec.description) ||
        (typeof firstReq?.description === 'string' && firstReq.description) ||
        undefined;

      const rawAllowed = Array.isArray(rec.allowedDecisions)
        ? rec.allowedDecisions
        : Array.isArray(rec.allowed_decisions)
          ? rec.allowed_decisions
          : ['approve', 'reject'];

      const allowedDecisions = rawAllowed.filter(
        (d): d is 'approve' | 'reject' | 'edit' =>
          d === 'approve' || d === 'reject' || d === 'edit',
      );

      const id =
        (typeof rec.id === 'string' && rec.id) ||
        (typeof rec.interrupt_id === 'string' && rec.interrupt_id) ||
        `hitl-${idx}-${tool ?? 'action'}`;

      return {
        id,
        tool,
        description,
        args,
        allowedDecisions:
          allowedDecisions.length > 0 ? allowedDecisions : ['approve', 'reject'],
        raw: entry,
      };
    });
  }

  return [
    {
      id: `hitl-0-${typeof action.tool === 'string' ? action.tool : 'action'}`,
      tool: typeof action.tool === 'string' ? action.tool : undefined,
      description:
        typeof action.description === 'string' ? action.description : undefined,
      args: input ?? undefined,
      allowedDecisions: ['approve', 'reject'],
      raw: action,
    },
  ];
}

function decodeActionPayload(rawAction: Record<string, unknown>): AiStreamEvent[] {
  if (rawAction.needs_confirm === true) {
    const interrupts = normalizeHitlInterrupts(rawAction);
    return [
      {
        type: 'hitl-interrupt',
        interruptId: interrupts[0]?.id ?? `hitl-${Date.now()}`,
        interrupts,
        raw: rawAction,
      },
    ];
  }

  const actionType =
    typeof rawAction.type === 'string' ? rawAction.type : 'tool_call';
  const tool =
    typeof rawAction.tool === 'string'
      ? rawAction.tool
      : typeof rawAction.action === 'string'
        ? rawAction.action
        : undefined;
  const agent = typeof rawAction.agent === 'string' ? rawAction.agent : undefined;
  const input = asRecord(rawAction.input) ?? undefined;
  const output = asRecord(rawAction.output) ?? undefined;
  const error = typeof rawAction.error === 'string' ? rawAction.error : undefined;

  switch (actionType) {
    case 'agent_handoff':
      return [
        {
          type: 'agent-handoff',
          to: typeof rawAction.to === 'string' ? rawAction.to : agent || 'agent',
          parallel:
            typeof rawAction.parallel === 'boolean' ? rawAction.parallel : undefined,
        },
      ];

    case 'thinking':
      return [{ type: 'thinking', agent }];

    case 'agent_done':
      return [
        {
          type: 'agent-done',
          agent,
          status: rawAction.status === 'error' ? 'error' : 'done',
          error,
          success:
            typeof rawAction.success === 'boolean'
              ? rawAction.success
              : rawAction.status !== 'error',
        },
      ];

    case 'tool_start':
      return [
        {
          type: 'tool-start',
          tool: tool || 'tool',
          agent,
          input,
        },
      ];

    case 'tool_end':
      return [
        {
          type: 'tool-end',
          tool: tool || 'tool',
          agent,
          status: rawAction.status === 'error' ? 'error' : 'done',
          output,
          error,
          success:
            typeof rawAction.success === 'boolean'
              ? rawAction.success
              : rawAction.status !== 'error',
          count:
            typeof rawAction.count === 'number' ? rawAction.count : undefined,
          action:
            typeof rawAction.action === 'string' ? rawAction.action : undefined,
          widgets: Array.isArray(rawAction.widgets)
            ? (rawAction.widgets as ResponseWidget[])
            : undefined,
        },
      ];

    case 'editor_patch_preview': {
      const patchRec = asRecord(rawAction.patch);
      if (
        !patchRec ||
        typeof patchRec.filePath !== 'string' ||
        !patchRec.filePath.trim()
      ) {
        return [];
      }
      return [
        {
          type: 'editor-patch-preview',
          agent,
          patch: patchRec as unknown as EditorPatchItem,
          ...(typeof rawAction.totalPatches === 'number'
            ? { totalPatches: rawAction.totalPatches }
            : {}),
        },
      ];
    }

    case 'tool_call':
    default: {
      if (rawAction.status === 'done' || rawAction.status === 'error') {
        return [
          {
            type: 'tool-end',
            tool: tool || 'tool',
            agent,
            status: rawAction.status,
            output,
            error,
            success:
              typeof rawAction.success === 'boolean'
                ? rawAction.success
                : rawAction.status === 'done',
            count:
              typeof rawAction.count === 'number' ? rawAction.count : undefined,
            action:
              typeof rawAction.action === 'string' ? rawAction.action : undefined,
            widgets: Array.isArray(rawAction.widgets)
              ? (rawAction.widgets as ResponseWidget[])
              : undefined,
          },
        ];
      }

      if (tool) {
        return [
          {
            type: 'tool-start',
            tool,
            agent,
            input,
          },
        ];
      }
      return [];
    }
  }
}

export function decodeFluxSseFrame(
  eventName: string,
  rawData: string,
): AiStreamEvent[] {
  if (eventName === 'error') {
    const parsed = rawData.startsWith('{')
      ? (() => {
          try {
            return asRecord(JSON.parse(rawData));
          } catch {
            return null;
          }
        })()
      : null;
    const message =
      (typeof parsed?.error === 'string' && parsed.error) ||
      (typeof parsed?.message === 'string' && parsed.message) ||
      (rawData && rawData !== '[DONE]' ? rawData : 'AI stream error');
    return [{ type: 'error', message }];
  }

  if (rawData === '[DONE]') {
    return [{ type: 'done' }];
  }

  if (rawData.startsWith('[META]')) {
    try {
      const meta = asRecord(JSON.parse(rawData.slice(6)));
      if (!meta) return [];
      return [
        {
          type: 'meta',
          chatId: typeof meta.chatId === 'string' ? meta.chatId : undefined,
          title: typeof meta.title === 'string' ? meta.title : undefined,
          agent: typeof meta.agent === 'string' ? meta.agent : undefined,
          intent: typeof meta.intent === 'string' ? meta.intent : undefined,
          sources: Array.isArray(meta.sources)
            ? (meta.sources as SourceItem[])
            : undefined,
          widgets: Array.isArray(meta.widgets)
            ? (meta.widgets as ResponseWidget[])
            : undefined,
        },
      ];
    } catch (err) {
      logger.debug('[sse] Failed to parse [META] frame', { err });
      return [];
    }
  }

  if (rawData.startsWith('[ACTION]')) {
    try {
      const action = asRecord(JSON.parse(rawData.slice(8)));
      if (!action) return [];
      return decodeActionPayload(action);
    } catch (err) {
      logger.debug('[sse] Failed to parse [ACTION] frame', { err });
      return [];
    }
  }

  if (rawData.startsWith('{')) {
    try {
      const parsed = asRecord(JSON.parse(rawData));
      if (parsed) {
        if (parsed.type === 'meta') {
          const metaObj = asRecord(parsed.data) ?? parsed;
          return [
            {
              type: 'meta',
              chatId:
                typeof metaObj.chatId === 'string' ? metaObj.chatId : undefined,
              title:
                typeof metaObj.title === 'string' ? metaObj.title : undefined,
              agent:
                typeof metaObj.agent === 'string' ? metaObj.agent : undefined,
              intent:
                typeof metaObj.intent === 'string' ? metaObj.intent : undefined,
              sources: Array.isArray(metaObj.sources)
                ? (metaObj.sources as SourceItem[])
                : undefined,
              widgets: Array.isArray(metaObj.widgets)
                ? (metaObj.widgets as ResponseWidget[])
                : undefined,
            },
          ];
        }
        if (parsed.type === 'action') {
          const actObj = asRecord(parsed.data) ?? parsed;
          return decodeActionPayload(actObj);
        }
        if (typeof parsed.error === 'string' && parsed.error) {
          return [{ type: 'error', message: parsed.error }];
        }
        if (typeof parsed.delta === 'string') {
          return [{ type: 'text-delta', delta: unescapeNewlines(parsed.delta) }];
        }
        if (typeof parsed.content === 'string') {
          return [{ type: 'text-delta', delta: unescapeNewlines(parsed.content) }];
        }
        if (typeof parsed.text === 'string') {
          return [{ type: 'text-delta', delta: unescapeNewlines(parsed.text) }];
        }
        const output = asRecord(parsed.output);
        if (output && typeof output.content === 'string') {
          return [
            { type: 'text-delta', delta: unescapeNewlines(output.content) },
          ];
        }
        if (typeof parsed.chat_id === 'string') {
          return [{ type: 'meta', chatId: parsed.chat_id }];
        }
        return [];
      }
    } catch {
      // Non-JSON or malformed JSON falls through as plain text
    }
  }

  return [{ type: 'text-delta', delta: unescapeNewlines(rawData) }];
}

export class SseFrameParser {
  private readonly decoder = new TextDecoder('utf-8');
  private buffer = '';

  feed(chunk: Uint8Array): RawSseFrame[] {
    const text = this.decoder.decode(chunk, { stream: true });
    return this.feedText(text);
  }

  feedText(input: string): RawSseFrame[] {
    return this.extractFrames(input, false);
  }

  flush(): RawSseFrame[] {
    const remaining = this.decoder.decode();
    return this.extractFrames(remaining, true);
  }

  private extractFrames(input: string, forceFlush: boolean): RawSseFrame[] {
    const normalized = input.replace(/\r\n/g, '\n');
    this.buffer += normalized;

    const blocks = this.buffer.split('\n\n');
    if (forceFlush) {
      this.buffer = '';
    } else {
      this.buffer = blocks.pop() ?? '';
    }

    const frames: RawSseFrame[] = [];
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of trimmed.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() || 'message';
        } else if (line.startsWith('data:')) {
          const val = line.slice(5);
          dataLines.push(val.startsWith(' ') ? val.slice(1) : val);
        }
      }

      if (dataLines.length > 0) {
        frames.push({
          event: eventName,
          data: dataLines.join('\n'),
        });
      }
    }

    return frames;
  }
}

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

function trailingPartialTagLength(text: string, tag: string): number {
  const maxCheck = Math.min(text.length, tag.length - 1);
  for (let len = maxCheck; len >= 1; len--) {
    if (tag.startsWith(text.slice(text.length - len))) {
      return len;
    }
  }
  return 0;
}

export class ThinkTagSplitter {
  private inThink = false;
  private carry = '';

  feed(chunk: string): Array<Extract<AiStreamEvent, { type: 'text-delta' | 'reasoning-delta' }>> {
    this.carry += chunk;
    const out: Array<Extract<AiStreamEvent, { type: 'text-delta' | 'reasoning-delta' }>> = [];

    while (this.carry.length > 0) {
      if (!this.inThink) {
        const openIdx = this.carry.indexOf(OPEN_TAG);
        if (openIdx !== -1) {
          if (openIdx > 0) {
            out.push({ type: 'text-delta', delta: this.carry.slice(0, openIdx) });
          }
          this.carry = this.carry.slice(openIdx + OPEN_TAG.length);
          this.inThink = true;
          continue;
        }

        const partialLen = trailingPartialTagLength(this.carry, OPEN_TAG);
        const safeLen = this.carry.length - partialLen;
        if (safeLen > 0) {
          out.push({ type: 'text-delta', delta: this.carry.slice(0, safeLen) });
          this.carry = this.carry.slice(safeLen);
        }
        break;
      } else {
        const closeIdx = this.carry.indexOf(CLOSE_TAG);
        if (closeIdx !== -1) {
          if (closeIdx > 0) {
            out.push({
              type: 'reasoning-delta',
              delta: this.carry.slice(0, closeIdx),
            });
          }
          this.carry = this.carry.slice(closeIdx + CLOSE_TAG.length);
          // Trim single leading newline after </think>
          if (this.carry.startsWith('\n')) {
            this.carry = this.carry.replace(/^\n+/, '');
          }
          this.inThink = false;
          continue;
        }

        const partialLen = trailingPartialTagLength(this.carry, CLOSE_TAG);
        const safeLen = this.carry.length - partialLen;
        if (safeLen > 0) {
          out.push({
            type: 'reasoning-delta',
            delta: this.carry.slice(0, safeLen),
          });
          this.carry = this.carry.slice(safeLen);
        }
        break;
      }
    }

    return out;
  }

  flush(): Array<Extract<AiStreamEvent, { type: 'text-delta' | 'reasoning-delta' }>> {
    if (!this.carry) return [];
    const delta = this.carry;
    this.carry = '';
    return [
      this.inThink
        ? { type: 'reasoning-delta', delta }
        : { type: 'text-delta', delta },
    ];
  }
}
