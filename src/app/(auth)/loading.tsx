import { Skeleton } from '@/shared/components/ui/skeleton';

export default function AuthLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand / Logo skeleton */}
        <div className="flex flex-col items-center space-y-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-md" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>

        {/* Form skeleton card */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-xs">
          <div className="space-y-2">
            <Skeleton className="h-4 w-12 rounded-sm" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 rounded-sm" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-full rounded-md mt-2" />
        </div>
      </div>
    </main>
  );
}
