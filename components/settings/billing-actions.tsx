"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

async function startBillingFlow(endpoint: string) {
  const response = await fetch(endpoint, {
    method: "POST",
  });
  const payload = (await response.json()) as { error?: string; url?: string };

  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Billing request failed.");
  }

  window.location.href = payload.url;
}

export function BillingActions({
  hasSubscription,
  showPortal = true,
}: {
  hasSubscription: boolean;
  showPortal?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheckout() {
    setError(null);
    startTransition(async () => {
      try {
        await startBillingFlow("/api/billing/checkout");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Billing request failed.");
      }
    });
  }

  function handlePortal() {
    setError(null);
    startTransition(async () => {
      try {
        await startBillingFlow("/api/billing/portal");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Billing request failed.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {!hasSubscription ? (
          <Button disabled={isPending} onClick={handleCheckout} type="button">
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Upgrade with Stripe
          </Button>
        ) : null}
        {showPortal ? (
          <Button disabled={isPending} onClick={handlePortal} type="button" variant="secondary">
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Manage billing
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
          {error}
        </div>
      ) : null}
    </div>
  );
}
