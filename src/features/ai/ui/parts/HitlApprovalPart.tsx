'use client';

import React, { memo, useId, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  GitMerge,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type {
  HitlDecision,
  HitlInterrupt,
  MessagePart,
} from '../../types/message';
import { CATEGORY_SURFACE, getToolMeta } from '../registry/tools';

export type HitlPartData = Extract<MessagePart, { type: 'hitl' }>;

export interface HitlApprovalPartProps {
  part: HitlPartData;
  onResume?: (decisions: HitlDecision[]) => void | Promise<void>;
  compact?: boolean;
}

interface AffectedItem {
  id: string;
  title: string;
}

interface ActionMeta {
  isDestructive: boolean;
  headerTitle: string;
  HeaderIcon: LucideIcon;
  confirmLabel: string;
  submittingLabel: string;
  cancelLabel: string;
}

const UUID_PAREN_REGEX =
  /\s*\([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi;

const STRUCTURED_ARG_KEYS = new Set([
  'items',
  'item_ids',
  'duplicates',
  'duplicate_item_ids',
  'primary_item_id',
  'primary_title',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 8) : id;
}

function stripTrailingUuid(text: string): string {
  return text.replace(UUID_PAREN_REGEX, '').replace(/\s{2,}/g, ' ').trim();
}

function extractTrashItems(args?: Record<string, unknown>): AffectedItem[] {
  const rawItems = args?.items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const parsed = rawItems
      .map((entry): AffectedItem | null => {
        const rec = asRecord(entry);
        if (!rec) return null;
        const id = typeof rec.id === 'string' ? rec.id.trim() : '';
        const title = typeof rec.title === 'string' ? rec.title.trim() : '';
        if (!id && !title) return null;
        return { id, title };
      })
      .filter((item): item is AffectedItem => item !== null);
    if (parsed.length > 0) return parsed;
  }

  const rawIds = args?.item_ids;
  if (Array.isArray(rawIds)) {
    return rawIds
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => ({ id: id.trim(), title: '' }));
  }

  return [];
}

function extractMergeData(args?: Record<string, unknown>): {
  primary: AffectedItem;
  duplicates: AffectedItem[];
} {
  const primaryId =
    typeof args?.primary_item_id === 'string' ? args.primary_item_id.trim() : '';
  const primaryTitle =
    typeof args?.primary_title === 'string' ? args.primary_title.trim() : '';

  const rawDuplicates = args?.duplicates;
  let duplicates: AffectedItem[] = [];
  if (Array.isArray(rawDuplicates) && rawDuplicates.length > 0) {
    duplicates = rawDuplicates
      .map((entry): AffectedItem | null => {
        const rec = asRecord(entry);
        if (!rec) return null;
        const id = typeof rec.id === 'string' ? rec.id.trim() : '';
        const title = typeof rec.title === 'string' ? rec.title.trim() : '';
        if (!id && !title) return null;
        return { id, title };
      })
      .filter((item): item is AffectedItem => item !== null);
  } else if (Array.isArray(args?.duplicate_item_ids)) {
    duplicates = args.duplicate_item_ids
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => ({ id: id.trim(), title: '' }));
  }

  return {
    primary: { id: primaryId, title: primaryTitle },
    duplicates,
  };
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const cleaned = stripTrailingUuid(value);
    return cleaned.length > 0 ? cleaned : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const primitives = value.filter(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean',
    );
    if (primitives.length !== value.length) return null;
    const preview = primitives.slice(0, 3).map(String).join(', ');
    return primitives.length > 3
      ? `${preview} (+${primitives.length - 3} more)`
      : preview;
  }
  return null;
}

function extractGenericFields(
  args?: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  if (!args) return [];
  const fields: Array<{ label: string; value: string }> = [];
  for (const [key, rawValue] of Object.entries(args)) {
    if (STRUCTURED_ARG_KEYS.has(key)) continue;
    const formatted = formatFieldValue(rawValue);
    if (!formatted) continue;
    fields.push({ label: formatFieldLabel(key), value: formatted });
    if (fields.length >= 6) break;
  }
  return fields;
}

function resolveActionMeta(interrupts: readonly HitlInterrupt[]): ActionMeta {
  const isDestructive = interrupts.some((intr) => {
    if (intr.tool === 'trash_items' || intr.tool === 'merge_duplicates') {
      return true;
    }
    return intr.tool ? getToolMeta(intr.tool).category === 'delete' : false;
  });

  if (interrupts.length === 1) {
    const intr = interrupts[0];
    const tool = intr?.tool || '';
    if (tool === 'trash_items') {
      const items = extractTrashItems(intr?.args);
      return {
        isDestructive: true,
        headerTitle:
          items.length > 1
            ? `Move ${items.length} items to Trash`
            : 'Move to Trash',
        HeaderIcon: Trash2,
        confirmLabel: 'Move to Trash',
        submittingLabel: 'Moving…',
        cancelLabel: 'Cancel',
      };
    }

    if (tool === 'merge_duplicates') {
      return {
        isDestructive: true,
        headerTitle: 'Merge duplicate items',
        HeaderIcon: GitMerge,
        confirmLabel: 'Merge items',
        submittingLabel: 'Merging…',
        cancelLabel: 'Cancel',
      };
    }

    if (tool === 'add_bibtex_entries') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: false,
        headerTitle: 'Add BibTeX Entries',
        HeaderIcon: meta.icon,
        confirmLabel: 'Add to .bib',
        submittingLabel: 'Adding…',
        cancelLabel: 'Reject',
      };
    }

    if (tool === 'resolve_citation') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: false,
        headerTitle: 'Resolve & Add Citation',
        HeaderIcon: meta.icon,
        confirmLabel: 'Resolve & Add',
        submittingLabel: 'Resolving…',
        cancelLabel: 'Reject',
      };
    }

    if (tool === 'sync_library_citations') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: false,
        headerTitle: 'Sync Library Citations',
        HeaderIcon: meta.icon,
        confirmLabel: 'Sync Collection',
        submittingLabel: 'Syncing…',
        cancelLabel: 'Reject',
      };
    }

    if (tool === 'create_review_suggestion') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: false,
        headerTitle: 'Create Track Changes Suggestion',
        HeaderIcon: meta.icon,
        confirmLabel: 'Create Suggestion',
        submittingLabel: 'Creating…',
        cancelLabel: 'Reject',
      };
    }

    if (tool === 'delete_work_item') {
      const mode = intr?.args?.mode === 'delete' ? 'delete' : 'archive';
      const meta = getToolMeta(tool);
      return {
        isDestructive: true,
        headerTitle: mode === 'delete' ? 'Delete Work Item' : 'Archive Work Item',
        HeaderIcon: meta.icon,
        confirmLabel: mode === 'delete' ? 'Delete Item' : 'Archive Item',
        submittingLabel: 'Updating…',
        cancelLabel: 'Cancel',
      };
    }

    if (tool === 'remove_project_member') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: true,
        headerTitle: 'Remove Project Member',
        HeaderIcon: meta.icon,
        confirmLabel: 'Remove Member',
        submittingLabel: 'Removing…',
        cancelLabel: 'Cancel',
      };
    }

    if (tool === 'update_member_role') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: false,
        headerTitle: 'Update Member Role',
        HeaderIcon: meta.icon,
        confirmLabel: 'Update Role',
        submittingLabel: 'Updating…',
        cancelLabel: 'Reject',
      };
    }

    if (tool === 'update_project') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: false,
        headerTitle: 'Update Project Settings',
        HeaderIcon: meta.icon,
        confirmLabel: 'Save Changes',
        submittingLabel: 'Saving…',
        cancelLabel: 'Reject',
      };
    }

    if (tool === 'delete_label') {
      const meta = getToolMeta(tool);
      return {
        isDestructive: true,
        headerTitle: 'Delete Project Label',
        HeaderIcon: meta.icon,
        confirmLabel: 'Delete Label',
        submittingLabel: 'Deleting…',
        cancelLabel: 'Cancel',
      };
    }

    const meta = tool ? getToolMeta(tool) : null;
    return {
      isDestructive,
      headerTitle: meta?.label || 'Confirm action',
      HeaderIcon: meta?.icon || ShieldAlert,
      confirmLabel: 'Approve',
      submittingLabel: 'Applying…',
      cancelLabel: isDestructive ? 'Cancel' : 'Reject',
    };
  }

  return {
    isDestructive,
    headerTitle:
      interrupts.length > 1
        ? `Confirm ${interrupts.length} actions`
        : 'Confirm action',
    HeaderIcon: isDestructive ? Trash2 : ShieldAlert,
    confirmLabel: 'Approve',
    submittingLabel: 'Applying…',
    cancelLabel: isDestructive ? 'Cancel' : 'Reject',
  };
}

function AffectedItemRow({
  item,
  compact,
  badge,
}: {
  item: AffectedItem;
  compact: boolean;
  badge?: { label: string; className: string };
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 min-h-8">
      <div className="flex items-center gap-2 min-w-0">
        {badge ? (
          <span
            className={cn(
              'h-5 px-1.5 rounded-sm text-11 font-medium inline-flex items-center shrink-0',
              badge.className,
            )}
          >
            {badge.label}
          </span>
        ) : (
          <FileText
            className="size-3.5 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            'font-medium text-foreground truncate',
            compact ? 'text-12' : 'text-13',
          )}
          title={item.title || item.id || undefined}
        >
          {item.title || 'Untitled item'}
        </span>
      </div>

      {item.id && (
        <span
          className="font-mono text-11 text-muted-foreground bg-card border border-border rounded-[3px] px-1.5 py-0.5 shrink-0 tabular-nums"
          title={item.id}
        >
          {shortId(item.id)}
        </span>
      )}
    </div>
  );
}

function InterruptBody({
  intr,
  compact,
  showSubheader,
}: {
  intr: HitlInterrupt;
  compact: boolean;
  showSubheader: boolean;
}) {
  const toolName = intr.tool || '';
  const meta = toolName ? getToolMeta(toolName) : null;
  const SubIcon = meta?.icon || ShieldAlert;

  const bodyTextClass = compact
    ? 'text-12 leading-snug text-muted-foreground'
    : 'text-13 leading-[1.54] text-muted-foreground';

  const renderSubheader = showSubheader && (
    <div className="flex items-center gap-2 mb-1.5">
      {meta ? (
        <span className={cn('p-1 rounded-sm', CATEGORY_SURFACE[meta.category])}>
          <SubIcon className="size-3 shrink-0" aria-hidden="true" />
        </span>
      ) : (
        <SubIcon
          className="size-3.5 text-muted-foreground shrink-0"
          aria-hidden="true"
        />
      )}
      <span className="text-12 font-medium text-foreground truncate">
        {meta?.label || toolName || 'Action'}
      </span>
    </div>
  );

  if (toolName === 'trash_items') {
    const items = extractTrashItems(intr.args);
    const visibleItems = items.slice(0, 5);
    const overflowCount = Math.max(0, items.length - visibleItems.length);
    const fallbackDesc = intr.description
      ? stripTrailingUuid(intr.description)
      : '';

    return (
      <div className="py-2.5 first:pt-0 last:pb-0">
        {renderSubheader}
        <p className={bodyTextClass}>
          {items.length === 0 && fallbackDesc
            ? fallbackDesc
            : items.length <= 1
              ? 'Move this library item to Trash? You can restore it from Trash at any time.'
              : `Move ${items.length} library items to Trash? You can restore them from Trash at any time.`}
        </p>

        {visibleItems.length > 0 && (
          <div className="mt-2 rounded-md border border-border bg-surface divide-y divide-border-subtle">
            {visibleItems.map((item, idx) => (
              <AffectedItemRow
                key={item.id || `${idx}-${item.title}`}
                item={item}
                compact={compact}
              />
            ))}
            {overflowCount > 0 && (
              <div className="px-2.5 py-1.5 text-11 text-muted-foreground">
                +{overflowCount} more {overflowCount === 1 ? 'item' : 'items'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (toolName === 'merge_duplicates') {
    const { primary, duplicates } = extractMergeData(intr.args);
    const visibleDuplicates = duplicates.slice(0, 4);
    const overflowCount = Math.max(
      0,
      duplicates.length - visibleDuplicates.length,
    );
    const duplicateCount = duplicates.length || 1;

    return (
      <div className="py-2.5 first:pt-0 last:pb-0">
        {renderSubheader}
        <p className={bodyTextClass}>
          {`Merge ${duplicateCount} duplicate ${
            duplicateCount === 1 ? 'item' : 'items'
          } into the primary record? Metadata and attachments will be consolidated.`}
        </p>

        {(primary.id || primary.title || visibleDuplicates.length > 0) && (
          <div className="mt-2 rounded-md border border-border bg-surface divide-y divide-border-subtle">
            {(primary.id || primary.title) && (
              <AffectedItemRow
                item={primary}
                compact={compact}
                badge={{
                  label: 'Primary',
                  className:
                    'bg-primary-subtle border border-primary-border text-primary',
                }}
              />
            )}
            {visibleDuplicates.map((dup, idx) => (
              <AffectedItemRow
                key={dup.id || `${idx}-${dup.title}`}
                item={dup}
                compact={compact}
                badge={{
                  label: 'Duplicate',
                  className: 'bg-muted text-muted-foreground',
                }}
              />
            ))}
            {overflowCount > 0 && (
              <div className="px-2.5 py-1.5 text-11 text-muted-foreground">
                +{overflowCount} more duplicate{' '}
                {overflowCount === 1 ? 'item' : 'items'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const cleanedDescription = intr.description
    ? stripTrailingUuid(intr.description)
    : '';
  const fields = extractGenericFields(intr.args);

  return (
    <div className="py-2.5 first:pt-0 last:pb-0 space-y-2">
      {renderSubheader}
      {cleanedDescription && (
        <p
          className={cn(
            'text-foreground',
            compact ? 'text-12 leading-snug' : 'text-13 leading-[1.54]',
          )}
        >
          {cleanedDescription}
        </p>
      )}
      {fields.length > 0 && (
        <div className="rounded-md border border-border bg-surface divide-y divide-border-subtle">
          {fields.map((field) => (
            <div
              key={field.label}
              className="px-2.5 py-1.5 text-12 flex items-baseline justify-between gap-3"
            >
              <span className="text-muted-foreground shrink-0">
                {field.label}
              </span>
              <span className="text-foreground font-medium text-right break-words min-w-0">
                {field.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const HitlApprovalPart = memo(function HitlApprovalPart({
  part,
  onResume,
  compact = false,
}: HitlApprovalPartProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const headingId = useId();
  const detailsId = useId();

  const isPending = part.status === 'pending';
  const isSubmitting = part.status === 'submitting';
  const isApproved = part.status === 'approved';
  const isRejected = part.status === 'rejected';

  const actionMeta = useMemo(
    () => resolveActionMeta(part.interrupts),
    [part.interrupts],
  );
  const HeaderIcon = actionMeta.HeaderIcon;

  const hasTechnicalDetails = useMemo(
    () =>
      part.interrupts.some(
        (intr) =>
          Boolean(intr.tool) || (intr.args && Object.keys(intr.args).length > 0),
      ),
    [part.interrupts],
  );
  const showActionButtons = (isPending || isSubmitting) && Boolean(onResume);

  const statusLabel = isPending
    ? compact
      ? 'Confirm'
      : 'Confirmation required'
    : isSubmitting
      ? 'Applying…'
      : isApproved
        ? 'Approved'
        : 'Cancelled';

  const statusDotClass = isApproved
    ? 'bg-success'
    : isRejected || isSubmitting
      ? 'bg-muted-foreground'
      : 'bg-warning';

  const handleDecision = (decision: 'approve' | 'reject') => {
    if (!onResume || isSubmitting) return;
    const decisions: HitlDecision[] = part.interrupts.map((intr) => ({
      decision,
      interruptId: intr.id,
    }));
    void onResume(decisions);
  };

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      aria-busy={isSubmitting}
      className="my-2 rounded-md border border-border bg-card overflow-hidden"
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b border-border bg-panel/40',
          compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'size-6 rounded-md flex items-center justify-center shrink-0',
              isApproved
                ? 'bg-success/10 text-success'
                : isRejected
                  ? 'bg-muted text-muted-foreground'
                  : actionMeta.isDestructive
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-warning/15 text-warning',
            )}
          >
            {isApproved ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : isRejected ? (
              <XCircle className="size-3.5" aria-hidden="true" />
            ) : (
              <HeaderIcon className="size-3.5" aria-hidden="true" />
            )}
          </div>
          <h4
            id={headingId}
            className={cn(
              'font-semibold text-foreground truncate',
              compact ? 'text-12' : 'text-13',
            )}
          >
            {actionMeta.headerTitle}
          </h4>
        </div>

        <span
          aria-live="polite"
          className="h-5 px-2 rounded-sm border border-border bg-card text-11 font-medium text-foreground inline-flex items-center gap-1.5 shrink-0"
        >
          <span
            className={cn('size-1.5 rounded-full shrink-0', statusDotClass)}
            aria-hidden="true"
          />
          <span>{statusLabel}</span>
        </span>
      </div>

      <div
        className={cn(
          'divide-y divide-border-subtle',
          compact ? 'px-2.5 py-2.5' : 'px-3.5 py-3',
        )}
      >
        {part.interrupts.length > 0 ? (
          part.interrupts.map((intr) => (
            <InterruptBody
              key={intr.id}
              intr={intr}
              compact={compact}
              showSubheader={part.interrupts.length > 1}
            />
          ))
        ) : (
          <p
            className={cn(
              'text-muted-foreground',
              compact ? 'text-12 leading-snug' : 'text-13 leading-[1.54]',
            )}
          >
            Review and confirm this action before continuing.
          </p>
        )}

        {isRejected && part.reason && part.reason.trim().length > 0 && (
          <p className="pt-2 text-12 text-muted-foreground">{part.reason}</p>
        )}
      </div>

      {detailsOpen && hasTechnicalDetails && (
        <div
          id={detailsId}
          className={cn(
            'border-t border-border bg-surface/60 space-y-2',
            compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5',
          )}
        >
          {part.interrupts.map((intr) => (
            <div key={`details-${intr.id}`} className="space-y-1 min-w-0">
              {intr.tool && (
                <div className="flex items-center gap-1.5 text-11 text-muted-foreground">
                  <span>Tool:</span>
                  <code className="font-mono text-11 text-foreground">
                    {intr.tool}
                  </code>
                </div>
              )}
              {intr.args && Object.keys(intr.args).length > 0 && (
                <pre
                  tabIndex={0}
                  className="rounded-md border border-border bg-card p-2.5 font-mono text-11 leading-relaxed text-foreground/85 overflow-x-auto max-h-48 outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {JSON.stringify(intr.args, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {(showActionButtons || hasTechnicalDetails) && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel/25',
            compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5',
          )}
        >
          {hasTechnicalDetails ? (
            <button
              type="button"
              aria-expanded={detailsOpen}
              aria-controls={detailsOpen ? detailsId : undefined}
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 min-h-8 px-2 text-12 font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
            >
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform motion-reduce:transition-none',
                  detailsOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
              <span>Details</span>
            </button>
          ) : (
            <span />
          )}

          {showActionButtons && (
            <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size={compact ? 'sm' : 'default'}
                disabled={isSubmitting}
                onClick={() => handleDecision('reject')}
                className={cn(
                  compact
                    ? 'h-7 px-2.5 text-12 relative before:absolute before:-inset-2 md:before:hidden'
                    : 'h-8 px-3 text-13 relative before:absolute before:-inset-1.5 md:before:hidden',
                )}
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>{actionMeta.cancelLabel}</span>
              </Button>
              <Button
                type="button"
                variant={actionMeta.isDestructive ? 'destructive' : 'default'}
                size={compact ? 'sm' : 'default'}
                disabled={isSubmitting}
                onClick={() => handleDecision('approve')}
                className={cn(
                  compact
                    ? 'h-7 px-2.5 text-12 relative before:absolute before:-inset-2 md:before:hidden'
                    : 'h-8 px-3 text-13 relative before:absolute before:-inset-1.5 md:before:hidden',
                )}
              >
                {isSubmitting ? (
                  <Loader2
                    className="size-3.5 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Check className="size-3.5" aria-hidden="true" />
                )}
                <span>
                  {isSubmitting
                    ? actionMeta.submittingLabel
                    : actionMeta.confirmLabel}
                </span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
