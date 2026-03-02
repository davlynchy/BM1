"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function RetryDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleRetry() {
    setError(null);
    const response = await fetch(`/api/documents/${documentId}/retry`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Retry failed.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button disabled={isPending} onClick={handleRetry} size="sm" type="button" variant="secondary">
        Retry
      </Button>
      {error ? <p className="text-xs text-muted">{error}</p> : null}
    </div>
  );
}
