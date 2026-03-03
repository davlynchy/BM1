"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <div className="panel max-w-lg p-8">
        <h2 className="font-heading text-3xl">Something went wrong</h2>
        <p className="mt-3 text-sm text-muted">{error.message}</p>
        <button
          className="mt-6 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
