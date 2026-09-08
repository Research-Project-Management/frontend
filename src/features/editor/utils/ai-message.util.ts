import type { ChatMessage } from '@/features/editor/types/editor-ai.types';
import type { AiEditResponse } from '@/features/editor/utils/ai.util';

export function isActionableAiEditResponse(value: unknown): value is AiEditResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<AiEditResponse>;
  return (
    typeof response.intent === 'string' &&
    typeof response.explanation === 'string' &&
    Array.isArray(response.edits) &&
    response.edits.length > 0
  );
}

export const EXPLANATION_ONLY_COMMANDS = ['/explain', '/cite', '/translate'];

export function normalizeSelectionContext(
  ctx?: ChatMessage['selectionContext'] | null,
): ChatMessage['selectionContext'] | undefined {
  if (!ctx?.filename || !ctx.startLine || !ctx.endLine || !ctx.text?.trim()) return undefined;
  return ctx;
}

export function isEditorActionMessage(content: string): boolean {
  return /```\s*(?:apply|diff|latex|tex\b|\n)/i.test(content);
}

export type AiEditStatus = 'applied' | 'dismissed';

export const AI_EDIT_STATUS_RE = /^<!-- ai-edit-status:([a-z0-9]+):(applied|dismissed) -->$/;

export function hashAiEditContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function makeAiEditStatusMessage(hash: string, status: AiEditStatus): ChatMessage {
  return {
    role: 'assistant',
    content: `<!-- ai-edit-status:${hash}:${status} -->`,
  };
}

export function parseAiEditStatus(content: string): { hash: string; status: AiEditStatus } | null {
  const match = content.trim().match(AI_EDIT_STATUS_RE);
  if (!match) return null;
  return { hash: match[1], status: match[2] as AiEditStatus };
}
