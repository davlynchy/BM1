"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CorrespondenceMetadata = Record<string, unknown>;

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function CorrespondenceReviewCard({
  item,
}: {
  item: {
    id: string;
    subject: string | null;
    sender: string | null;
    received_at: string | null;
    body_text: string | null;
    analysis_status: string | null;
    ai_summary: string | null;
    draft_reply: string | null;
    action_required: boolean | null;
    processing_error: string | null;
    metadata: CorrespondenceMetadata | null;
  };
}) {
  const [analysis, setAnalysis] = useState({
    aiSummary: item.ai_summary ?? "",
    draftReply: item.draft_reply ?? "",
    metadata: item.metadata ?? {},
    analysisStatus: item.analysis_status ?? "queued",
    processingError: item.processing_error ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const metadata = analysis.metadata;
  const keyPoints = asStringArray(metadata.keyPoints);
  const requestedActions = asStringArray(metadata.requestedActions);
  const deadlineSignals = asStringArray(metadata.deadlineSignals);
  const contractReferences = asStringArray(metadata.contractReferences);
  const sourceSignals = asStringArray(metadata.sourceSignals);

  function regenerateDraft() {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/correspondence/${item.id}/draft`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        analysis?: {
          summary: string;
          draftReply: string;
          situationSummary: string;
          commercialRisk: string;
          recommendedPosition: string;
          priority: string;
          recommendedTitle: string;
          recommendedAction: string;
          keyPoints: string[];
          requestedActions: string[];
          deadlineSignals: string[];
          contractReferences: string[];
          draftReplyShort: string;
          draftReplyFirm: string;
          draftReplyCollaborative: string;
          sourceSignals: string[];
        };
      };

      if (!response.ok || !payload.analysis) {
        setError(payload.error ?? "Unable to regenerate the draft.");
        return;
      }

      setAnalysis({
        aiSummary: payload.analysis.situationSummary,
        draftReply: payload.analysis.draftReply,
        analysisStatus: "completed",
        processingError: "",
        metadata: {
          priority: payload.analysis.priority,
          recommendedTitle: payload.analysis.recommendedTitle,
          recommendedAction: payload.analysis.recommendedAction,
          commercialRisk: payload.analysis.commercialRisk,
          recommendedPosition: payload.analysis.recommendedPosition,
          keyPoints: payload.analysis.keyPoints,
          requestedActions: payload.analysis.requestedActions,
          deadlineSignals: payload.analysis.deadlineSignals,
          contractReferences: payload.analysis.contractReferences,
          draftReplyShort: payload.analysis.draftReplyShort,
          draftReplyFirm: payload.analysis.draftReplyFirm,
          draftReplyCollaborative: payload.analysis.draftReplyCollaborative,
          sourceSignals: payload.analysis.sourceSignals,
        },
      });
    });
  }

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-text">{item.subject || "Untitled email"}</p>
        <Badge variant="secondary">{analysis.analysisStatus}</Badge>
        {item.action_required ? <Badge>Action required</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        From {item.sender || "Unknown sender"}
        {item.received_at ? ` on ${new Date(item.received_at).toLocaleString("en-AU")}` : ""}
      </p>
      <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-text">{item.body_text}</p>

      {analysis.aiSummary ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Situation</p>
            <p className="mt-2 text-sm text-text">{analysis.aiSummary}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Commercial position</p>
            <p className="mt-2 text-sm text-text">
              {typeof metadata.recommendedPosition === "string"
                ? metadata.recommendedPosition
                : "Drafting position will appear after analysis."}
            </p>
          </div>
        </div>
      ) : null}

      {keyPoints.length ? (
        <div className="mt-4 rounded-xl border border-border bg-panel p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Key points to cover</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {keyPoints.map((itemValue) => (
              <Badge key={`${item.id}-${itemValue}`} variant="secondary">
                {itemValue}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-panel p-3">
        <Tabs defaultValue="firm">
          <TabsList>
            <TabsTrigger value="firm">Firm</TabsTrigger>
            <TabsTrigger value="collaborative">Collaborative</TabsTrigger>
            <TabsTrigger value="short">Short</TabsTrigger>
          </TabsList>
          <TabsContent value="firm">
            <p className="whitespace-pre-wrap text-sm text-text">
              {typeof metadata.draftReplyFirm === "string"
                ? metadata.draftReplyFirm
                : analysis.draftReply || "Draft pending."}
            </p>
          </TabsContent>
          <TabsContent value="collaborative">
            <p className="whitespace-pre-wrap text-sm text-text">
              {typeof metadata.draftReplyCollaborative === "string"
                ? metadata.draftReplyCollaborative
                : analysis.draftReply || "Draft pending."}
            </p>
          </TabsContent>
          <TabsContent value="short">
            <p className="whitespace-pre-wrap text-sm text-text">
              {typeof metadata.draftReplyShort === "string"
                ? metadata.draftReplyShort
                : analysis.draftReply || "Draft pending."}
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {requestedActions.length || deadlineSignals.length || contractReferences.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Requested actions</p>
            <ul className="mt-2 space-y-2 text-sm text-text">
              {requestedActions.length ? requestedActions.map((value) => <li key={value}>{value}</li>) : <li>None identified.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Deadline signals</p>
            <ul className="mt-2 space-y-2 text-sm text-text">
              {deadlineSignals.length ? deadlineSignals.map((value) => <li key={value}>{value}</li>) : <li>No clear deadlines found.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Contract references</p>
            <ul className="mt-2 space-y-2 text-sm text-text">
              {contractReferences.length ? contractReferences.map((value) => <li key={value}>{value}</li>) : <li>No contract cross-reference used.</li>}
            </ul>
          </div>
        </div>
      ) : null}

      {sourceSignals.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {sourceSignals.map((signal) => (
            <Badge key={`${item.id}-${signal}`} variant="outline">
              {signal}
            </Badge>
          ))}
        </div>
      ) : null}

      {analysis.processingError || error ? (
        <p className="mt-4 text-sm text-muted">{error ?? analysis.processingError}</p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button disabled={isPending} onClick={regenerateDraft} size="sm" type="button" variant="secondary">
          {isPending ? "Regenerating..." : "Regenerate draft"}
        </Button>
      </div>
    </div>
  );
}
