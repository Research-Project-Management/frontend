'use client';

import { Button } from "@/shared/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="pt-16 p-4 container mx-auto space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Oops!</h1>
      <p className="text-sm text-muted-foreground">An unexpected error occurred.</p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="w-full p-4 overflow-x-auto rounded-md border border-border bg-muted text-xs">
          <code>{error.message}</code>
        </pre>
      )}
      <Button type="button" onClick={reset} variant="default" size="md">
        Try again
      </Button>
    </main>
  );
}
