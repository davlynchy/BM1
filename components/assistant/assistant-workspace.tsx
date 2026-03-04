"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AssistantComposer } from "@/components/assistant/assistant-composer";
import { OutputCard } from "@/components/assistant/output-card";
import { RunStatusCard } from "@/components/assistant/run-status-card";
import { SourceDrawer } from "@/components/assistant/source-drawer";
import { ThreadList } from "@/components/assistant/thread-list";
import { ThreadTimeline } from "@/components/assistant/thread-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssistantRunRecord, AssistantSourceSelection, AssistantThreadSummary } from "@/types/assistant";
import type { ProjectOutputRecord } from "@/types/outputs";
import type { VaultFileRecord } from "@/types/vault";
import type { AssistantMessageRecord } from "@/types/assistant";

type WorkspaceState = {
  activeThread: AssistantThreadSummary | null;
  threads: AssistantThreadSummary[];
  messages: AssistantMessageRecord[];
  sources: AssistantSourceSelection[];
  runs: AssistantRunRecord[];
  documents: VaultFileRecord[];
  outputs: ProjectOutputRecord[];
};

export function AssistantWorkspace({
  projectId,
  initialState,
}: {
  projectId: string;
  initialState: WorkspaceState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(
    initialState.sources.map((source) => source.documentId),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const indexedDocuments = useMemo(
    () => state.documents.filter((document) => document.parseStatus === "indexed"),
    [state.documents],
  );
  const hasPendingRun = useMemo(
    () => state.runs.some((run) => run.status === "queued" || run.status === "in_progress"),
    [state.runs],
  );
  const activeThreadId = state.activeThread?.id ?? null;

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((item) => item !== documentId)
        : [...current, documentId],
    );
  }

  function loadThread(threadId: string) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/assistant/threads/${threadId}/timeline`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        activeThread?: AssistantThreadSummary | null;
        threads?: AssistantThreadSummary[];
        messages?: AssistantMessageRecord[];
        sources?: AssistantSourceSelection[];
        runs?: AssistantRunRecord[];
        documents?: VaultFileRecord[];
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to load thread.");
        return;
      }

      setState((current) => ({
        ...current,
        activeThread: payload.activeThread ?? null,
        threads: payload.threads ?? current.threads,
        messages: payload.messages ?? [],
        sources: payload.sources ?? [],
        runs: payload.runs ?? [],
        documents: payload.documents ?? current.documents,
      }));
      setSelectedDocumentIds(payload.sources?.map((source) => source.documentId) ?? []);
    });
  }

  async function createThreadRequest() {
    const response = await fetch(`/api/projects/${projectId}/assistant/threads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "New thread",
        threadType: "project_assistant",
        sourceDocumentIds: selectedDocumentIds,
      }),
    });
    const payload = (await response.json()) as { error?: string; thread?: { id: string } };

    if (!response.ok || !payload.thread?.id) {
      throw new Error(payload.error ?? "Unable to create thread.");
    }

    return payload.thread.id;
  }

  function createThread() {
    setError(null);
    startTransition(async () => {
      try {
        const threadId = await createThreadRequest();
        loadThread(threadId);
        router.refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to create thread.");
        return;
      }
    });
  }

  function sendMessage(params: {
    message: string;
    mode: "auto" | "draft" | "answer";
    selectedOutputType: "email" | "memo" | "summary" | "checklist" | null;
  }) {
    setError(null);
    startTransition(async () => {
      let threadId = state.activeThread?.id ?? null;

      try {
        if (!threadId) {
          threadId = await createThreadRequest();
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to create thread.");
        return;
      }

      const response = await fetch(
        `/api/projects/${projectId}/assistant/threads/${threadId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: params.message,
            mode: params.mode,
            sourceDocumentIds: selectedDocumentIds,
            selectedOutputType: params.selectedOutputType,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        detail?: Omit<WorkspaceState, "outputs">;
      };

      const detail = payload.detail;

      if (!response.ok || !detail) {
        setError(payload.error ?? "Unable to send message.");
        return;
      }

      setState((current) => ({
        ...current,
        activeThread: detail.activeThread,
        threads: detail.threads,
        messages: detail.messages,
        sources: detail.sources,
        runs: detail.runs,
        documents: detail.documents,
      }));
    });
  }

  useEffect(() => {
    if (!activeThreadId || !hasPendingRun) {
      return;
    }

    const interval = setInterval(() => {
      void fetch(`/api/projects/${projectId}/assistant/threads/${activeThreadId}/timeline`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            error?: string;
            activeThread?: AssistantThreadSummary | null;
            threads?: AssistantThreadSummary[];
            messages?: AssistantMessageRecord[];
            sources?: AssistantSourceSelection[];
            runs?: AssistantRunRecord[];
            documents?: VaultFileRecord[];
          };

          if (!response.ok) {
            return;
          }

          setState((current) => ({
            ...current,
            activeThread: payload.activeThread ?? null,
            threads: payload.threads ?? current.threads,
            messages: payload.messages ?? [],
            sources: payload.sources ?? [],
            runs: payload.runs ?? [],
            documents: payload.documents ?? current.documents,
          }));
        })
        .catch(() => undefined);
    }, 2000);

    return () => clearInterval(interval);
  }, [activeThreadId, hasPendingRun, projectId]);

  async function createOutput(type: "email" | "memo" | "summary" | "checklist") {
    if (!state.activeThread?.id) {
      return;
    }

    const titleBase =
      state.activeThread.title && state.activeThread.title !== "New thread"
        ? state.activeThread.title
        : "Assistant output";

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/outputs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: state.activeThread?.id,
          type,
          title: `${titleBase} (${type})`,
        }),
      });
      const payload = (await response.json()) as { error?: string; output?: ProjectOutputRecord };

      if (!response.ok || !payload.output) {
        setError(payload.error ?? "Unable to create output.");
        return;
      }

      setState((current) => ({
        ...current,
        outputs: [payload.output!, ...current.outputs],
      }));
      router.push(`/app/projects/${projectId}/outputs/${payload.output.id}`);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Threads</CardTitle>
            </div>
            <Button onClick={createThread} size="sm" type="button" variant="secondary">
              New
            </Button>
          </CardHeader>
          <CardContent>
            <ThreadList
              activeThreadId={state.activeThread?.id ?? null}
              onSelect={loadThread}
              threads={state.threads}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{state.activeThread?.title ?? "AI Assistant"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThreadTimeline isUpdating={isPending} messages={state.messages} />
            {error ? (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                {error}
              </div>
            ) : null}
            <AssistantComposer disabled={isPending} onSubmit={sendMessage} />
            <div className="flex flex-wrap gap-2">
              {(["memo", "email", "summary", "checklist"] as const).map((type) => (
                <Button key={type} onClick={() => void createOutput(type)} size="sm" type="button" variant="secondary">
                  Create {type}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SourceDrawer
          attachedSources={state.sources}
          documents={indexedDocuments}
          onToggle={toggleDocument}
          selectedDocumentIds={selectedDocumentIds}
        />

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.runs.length ? state.runs.map((run) => <RunStatusCard key={run.id} run={run} />) : <p className="text-sm text-muted">No assistant runs yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent outputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.outputs.length ? (
              state.outputs.slice(0, 4).map((output) => <OutputCard key={output.id} output={output} projectId={projectId} />)
            ) : (
              <p className="text-sm text-muted">Promoted drafts and memos will appear here.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
