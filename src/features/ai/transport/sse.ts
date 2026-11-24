import type { AiStreamEvent } from '../types/event';
import { logger } from '@/shared/lib/logger';

export interface RawSseFrame {
  event: string;
  data: string;
}

const VALID_EVENT_TYPES = new Set<AiStreamEvent['type']>([
  'meta',
  'text-delta',
  'reasoning-delta',
  'agent-handoff',
  'thinking',
  'agent-done',
  'tool-start',
  'tool-end',
  'hitl-interrupt',
  'editor-patch-preview',
  'error',
  'done',
]);

export function decodeFluxSseFrame(
  _eventName: string,
  rawData: string,
): AiStreamEvent[] {
  const trimmed = rawData.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    logger.debug('[sse] Dropping non-JSON SSE frame', { err });
    return [];
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  const type = record.type;
  if (
    typeof type !== 'string' ||
    !VALID_EVENT_TYPES.has(type as AiStreamEvent['type'])
  ) {
    return [];
  }

  return [record as unknown as AiStreamEvent];
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

  feed(
    chunk: string,
  ): Array<Extract<AiStreamEvent, { type: 'text-delta' | 'reasoning-delta' }>> {
    this.carry += chunk;
    const out: Array<
      Extract<AiStreamEvent, { type: 'text-delta' | 'reasoning-delta' }>
    > = [];

    while (this.carry.length > 0) {
      if (!this.inThink) {
        const openIdx = this.carry.indexOf(OPEN_TAG);
        if (openIdx !== -1) {
          if (openIdx > 0) {
            out.push({
              type: 'text-delta',
              delta: this.carry.slice(0, openIdx),
            });
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

  flush(): Array<
    Extract<AiStreamEvent, { type: 'text-delta' | 'reasoning-delta' }>
  > {
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
