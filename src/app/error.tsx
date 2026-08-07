'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>Oops!</h1>
      <p>An unexpected error occurred.</p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{error.message}</code>
        </pre>
      )}
      <button onClick={reset}>Try again</button>
    </main>
  );
}
