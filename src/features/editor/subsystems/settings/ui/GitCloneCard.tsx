'use client';

/**
 * GitCloneCard.tsx
 *
 * Presentational view for Git Smart-HTTP clone URL & Personal Access Token management.
 * State & GoF Command orchestration live in `useGitClone`.
 */

import React from 'react';
import { Check, Copy, GitBranch, KeyRound } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useGitClone } from './hooks/useGitClone';

export interface GitCloneCardProps {
  projectId: string;
  pageId?: string;
  open: boolean;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function GitCloneCard(props: GitCloneCardProps) {
  const g = useGitClone(props);

  return (
    <div className="p-3.5 rounded-lg border border-border bg-card/40 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-13 font-medium text-foreground">
            Git Clone (Smart HTTP)
          </span>
          <span className="text-11 font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {g.branch}
          </span>
        </div>
        {!g.canPush && (
          <span className="text-11 text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            Read-only
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1">
        <code className="text-11 font-mono text-muted-foreground truncate flex-1 select-all">
          git clone {g.cloneUrl}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={g.copyUrl}
          disabled={g.loading}
          className="h-6 px-2 text-11 cursor-pointer shrink-0"
        >
          {g.copiedUrl ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
          <span className="ml-1">{g.copiedUrl ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      <p className="text-11 text-muted-foreground leading-relaxed">
        When prompted by Git, enter username{' '}
        <code className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">
          {g.username}
        </code>{' '}
        and use a Personal Access Token below as your password.
      </p>

      <div className="pt-2.5 border-t border-border/40 space-y-2">
        <div className="flex items-center gap-1.5">
          <KeyRound className="size-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground">
            Personal access tokens
          </span>
          <span className="text-11 text-muted-foreground">
            ({g.tokens.length}/{g.maxTokens})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={g.label}
            maxLength={100}
            onChange={(e) => g.setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !g.creating && !g.atLimit) {
                e.preventDefault();
                void g.createToken();
              }
            }}
            placeholder="Token label (e.g. Laptop CLI)"
            aria-label="Git token label"
            className="flex-1 h-7 rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border select-text"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={g.createToken}
            disabled={g.creating || g.atLimit}
            className="h-7 px-2.5 text-xs cursor-pointer shrink-0"
          >
            {g.creating ? 'Generating…' : 'Generate token'}
          </Button>
        </div>

        {g.newToken && (
          <div className="rounded-md border border-border bg-muted/60 px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-11 font-medium text-foreground">
                Copy your new token now — it will not be shown again:
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={g.copyToken}
                className="h-6 px-2 text-11 cursor-pointer shrink-0"
              >
                {g.copiedToken ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span className="ml-1">{g.copiedToken ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
            <code className="block font-mono text-11 text-foreground break-all select-all">
              {g.newToken}
            </code>
          </div>
        )}

        {g.tokens.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
            {g.tokens.map((tok) => {
              const exp = formatDate(tok.expiresAt);
              const used = formatDate(tok.lastUsedAt);
              return (
                <div
                  key={tok.id}
                  className="flex items-center justify-between gap-2 text-11 bg-background border border-border/60 rounded px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-foreground">
                      {tok.label}{' '}
                      <span className="text-muted-foreground">
                        ({tok.prefix}…)
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {used ? `Last used ${used}` : 'Never used'}
                      {exp ? ` · Expires ${exp}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={g.revokingId === tok.id}
                    onClick={() => g.revokeToken(tok.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
                    aria-label={`Revoke ${tok.label}`}
                  >
                    {g.revokingId === tok.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
