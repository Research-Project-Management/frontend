import type {
  EditorTurnContext,
  PaperTurnContext,
  TurnContext,
  TurnMode,
} from '../types/context';
import {
  getRagDocumentId,
  sourceEntryToAttachedPayload,
  sourcesToAttachments,
  type SourceEntry,
} from './source.port';

export interface BuildTurnPayloadInput {
  mode: TurnMode;
  spaceId?: string | null;
  chatId?: string | null;
  /** Sources in scope for RAG documentIds and attachedSources metadata (filtered to enabled). */
  sources?: readonly SourceEntry[];
  /** Optional separate source list for user-message attachment chips (defaults to `sources`). */
  attachmentSources?: readonly SourceEntry[];
  /** Extra RAG document IDs to merge and deduplicate with those derived from `sources`. */
  extraDocumentIds?: readonly string[] | null;
  webSearchEnabled?: boolean;
  webSearchSites?: readonly string[];
  /** Explicit override from external handoff prompts; `null` explicitly disables web search. */
  webSearchSitesOverride?: readonly string[] | null;
  paper?: PaperTurnContext;
  editor?: EditorTurnContext;
  intentHint?: string | null;
  modelId?: string | null;
}

/**
 * Resolve web search site restrictions for a turn.
 * - Explicit `override` takes precedence (`null` or empty disables web search).
 * - Otherwise, when `enabled` is true, returns configured `sites` or `['*']` wildcard.
 * - When disabled, returns `undefined`.
 */
export function buildWebSearchSites(
  enabled: boolean,
  sites?: readonly string[],
  override?: readonly string[] | null,
): string[] | undefined {
  if (override !== undefined) {
    return override && override.length > 0 ? [...override] : undefined;
  }
  if (!enabled) {
    return undefined;
  }
  return sites && sites.length > 0 ? [...sites] : ['*'];
}

/**
 * Assemble a normalized `TurnContext` payload from turn sources, web search settings,
 * and optional mode-specific context (`paper`, `editor`).
 */
export function buildTurnPayload(input: BuildTurnPayloadInput): TurnContext {
  const enabledSources = (input.sources ?? []).filter((s) => s.enabled);

  const documentIds = Array.from(
    new Set([
      ...(input.extraDocumentIds ?? []),
      ...enabledSources
        .map(getRagDocumentId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ).filter(Boolean);

  const attachedSources = enabledSources.map(sourceEntryToAttachedPayload);
  const attachments = sourcesToAttachments(
    input.attachmentSources ?? enabledSources,
  );
  const webSearchSites = buildWebSearchSites(
    Boolean(input.webSearchEnabled),
    input.webSearchSites,
    input.webSearchSitesOverride,
  );

  return {
    mode: input.mode,
    spaceId: input.spaceId,
    chatId: input.chatId,
    documentIds: documentIds.length > 0 ? documentIds : undefined,
    attachedSources: attachedSources.length > 0 ? attachedSources : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    webSearchSites,
    ...(input.paper ? { paper: input.paper } : {}),
    ...(input.editor ? { editor: input.editor } : {}),
    ...(input.intentHint !== undefined ? { intentHint: input.intentHint } : {}),
    ...(input.modelId !== undefined ? { modelId: input.modelId } : {}),
  };
}
