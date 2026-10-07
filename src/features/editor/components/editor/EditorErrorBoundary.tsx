'use client';

/**
 * EditorErrorBoundary.tsx
 *
 * Dedicated Error Boundary guarding the CodeMirror editing surface.
 * Prevents full cockpit crash when a third-party extension or syntax parser throws.
 * Provides instant recovery actions and draft preservation.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackContent?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class EditorErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[EditorErrorBoundary] Caught unhandled editor error:', error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null, copied: false });
    this.props.onReset?.();
  };

  private handleCopyFallback = (): void => {
    if (this.props.fallbackContent) {
      void navigator.clipboard.writeText(this.props.fallbackContent);
      this.setState({ copied: true });
      setTimeout(() => {
        this.setState({ copied: false });
      }, 2000);
    }
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-6 bg-canvas text-center select-none">
          <div className="flex items-center justify-center size-12 rounded-full bg-destructive/15 text-destructive mb-3">
            <AlertTriangle className="size-6 shrink-0" />
          </div>

          <h3 className="text-base font-semibold text-foreground mb-1">
            Editor Encountered an Issue
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mb-4">
            An unexpected error occurred while rendering the code editor. Your unsaved changes are preserved in memory.
          </p>

          {this.state.error && (
            <div className="w-full max-w-md p-2.5 mb-4 text-left font-mono text-11 rounded-md bg-muted/60 text-muted-foreground border border-border overflow-auto max-h-24">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={this.handleRetry}
              className="gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="size-3.5 shrink-0" />
              <span>Reload Editor</span>
            </Button>

            {this.props.fallbackContent && (
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleCopyFallback}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 shrink-0" />
                    <span>Copy Draft</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
