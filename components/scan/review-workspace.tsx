"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { BillingActions } from "@/components/settings/billing-actions";
import { ReviewMessageList } from "@/components/scan/review-message-list";
import { ReviewSidebar } from "@/components/scan/review-sidebar";
import { ReviewSuggestedPrompts } from "@/components/scan/review-suggested-prompts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantMessageRecord } from "@/types/assistant";
import type { ContractObligation, ScanFinding, ScanSummary } from "@/types/scans";

type ReviewTimeline = {
  scan: {
    id: string;
    status: "queued" | "in_progress" | "completed" | "failed";
    is_free_preview: boolean;
    summary: ScanSummary | null;
    processing_error: string | null;
  };
  project: {
    id: string;
    name: string;
  } | null;
  document: {
    id: string;
    name: string;
    parse_status: string;
  } | null;
  messages: AssistantMessageRecord[];
  findings: ScanFinding[];
  obligations: ContractObligation[];
  isLockedPreview: boolean;
  hasFullAccess: boolean;
};

function statusLabel(status: ReviewTimeline["scan"]["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "in_progress":
      return "Reviewing";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function ReviewWorkspace({
  scanId,
  initialTimeline,
}: {
  scanId: string;
  initialTimeline: ReviewTimeline;
}) {
  const [timeline, setTimeline] = useState(initialTimeline);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (timeline.scan.status === "completed" || timeline.scan.status === "failed") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      setIsPolling(true);

      try {
        const response = await fetch(`/api/scans/${scanId}/timeline`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ReviewTimeline & { error?: string };

        if (response.ok) {
          setTimeline(payload);
          setError(null);
        } else {
          setError(payload.error ?? "Unable to refresh the review timeline.");
        }
      } finally {
        setIsPolling(false);
      }
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [scanId, timeline.scan.status]);

  const canAskQuestions = timeline.hasFullAccess && timeline.scan.status !== "failed";
  const isBusy = isPending || isPolling;
  const helperCopy = useMemo(() => {
    if (timeline.scan.status === "failed") {
      return timeline.scan.processing_error ?? "The review failed before completion.";
    }

    if (timeline.scan.summary?.lastProgressMessage) {
      return timeline.scan.summary.lastProgressMessage;
    }

    return "Bidmetric is working through the contract and will post staged updates here.";
  }, [timeline.scan.processing_error, timeline.scan.status, timeline.scan.summary]);

  function askQuestion(nextQuestion: string) {
    const trimmed = nextQuestion.trim();

    if (!trimmed || !canAskQuestions) {
      return;
    }

    setError(null);
    setQuestion("");

    startTransition(async () => {
      const response = await fetch(`/api/scans/${scanId}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const payload = (await response.json()) as {
        error?: string;
        messages?: AssistantMessageRecord[];
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to answer that question.");
        setQuestion(trimmed);
        return;
      }

      setTimeline((current) => ({
        ...current,
        messages: [...current.messages, ...(payload.messages ?? [])],
      }));
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_24rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{timeline.scan.is_free_preview ? "Free summary" : "Full review"}</Badge>
              <Badge variant="secondary">{statusLabel(timeline.scan.status)}</Badge>
              {timeline.scan.summary?.confidence ? (
                <Badge variant="outline">{timeline.scan.summary.confidence} confidence</Badge>
              ) : null}
            </div>
            <div className="space-y-2">
              <CardTitle className="font-heading text-3xl">
                {timeline.project?.name ?? "Contract review workspace"}
              </CardTitle>
              <p className="text-sm text-muted">
                {helperCopy}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ReviewMessageList isUpdating={isPolling} messages={timeline.messages} />

            {timeline.isLockedPreview ? (
              <div className="rounded-2xl border border-border bg-panel p-4">
                <p className="text-sm text-muted">
                  This free summary shows the staged review and preview findings. Upgrade the
                  workspace to unlock full follow-up questions and the complete report.
                </p>
                <div className="mt-4">
                  <BillingActions hasSubscription={false} showPortal={false} />
                </div>
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-border bg-panel p-4">
              <ReviewSuggestedPrompts
                disabled={!canAskQuestions || isBusy}
                onSelect={(prompt) => askQuestion(prompt)}
              />
              <Textarea
                disabled={!canAskQuestions || isBusy}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={
                  canAskQuestions
                    ? "Ask a grounded contract question..."
                    : "Upgrade to ask follow-up questions about this contract."
                }
                value={question}
              />
              {error ? (
                <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                  {error}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  disabled={!canAskQuestions || isBusy || !question.trim()}
                  onClick={() => askQuestion(question)}
                  type="button"
                >
                  {isPending ? "Thinking..." : "Ask Bidmetric"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReviewSidebar
        documentName={timeline.document?.name ?? "Uploaded contract"}
        findings={timeline.findings}
        isLockedPreview={timeline.isLockedPreview}
        obligations={timeline.obligations}
        summary={timeline.scan.summary}
      />
    </div>
  );
}
