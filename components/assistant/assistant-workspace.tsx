"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AssistantComposer } from "@/components/assistant/assistant-composer";
import { SourceDrawer } from "@/components/assistant/source-drawer";
import { ThreadTimeline } from "@/components/assistant/thread-timeline";
import { Card, CardContent } from "@/components/ui/card";
import type { AssistantMessageRecord, AssistantRunRecord, AssistantSourceSelection, AssistantThreadSummary } from "@/types/assistant";
import type { ProjectOutputRecord } from "@/types/outputs";
import type { VaultFileRecord } from "@/types/vault";

type WorkspaceState = {
  activeThread: AssistantThreadSummary | null;
  threads: AssistantThreadSummary[];
  messages: AssistantMessageRecord[];
  sources: AssistantSourceSelection[];
  runs: AssistantRunRecord[];
  documents: VaultFileRecord[];
  outputs: ProjectOutputRecord[];
};

const promptGroups = {
  Draft: [
    "Draft email requesting extension of time",
    "Request tender submission feedback",
    "Draft RFI for unclear scope",
  ],
  Ask: [
    "Review subcontract red flags",
    "Draft a variation claim",
    "When is progress claim due?",
  ],
  Create: [
    "Create SWMS document",
    "Create toolbox talk",
    "Create working at heights permit",
  ],
} as const;

export function AssistantWorkspace({
  projectId,
  initialState,
  initialPrompt,
}: {
  projectId: string;
  initialState: WorkspaceState;
  initialPrompt?: string | null;
}) {
  const [state, setState] = useState(initialState);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(
    initialState.sources.map((source) => source.documentId),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeEventSourceRef = useRef<EventSource | null>(null);
  const activeThreadId = state.activeThread?.id ?? null;
  const hasPendingRun = useMemo(() => state.runs.some((run) => run.status !== "completed"), [state.runs]);
  const indexedDocuments = useMemo(
    () => state.documents.filter((document) => document.parseStatus === "indexed"),
    [state.documents],
  );
  const latestAssistantCitations = useMemo(() => {
    const latestAssistant = [...state.messages].reverse().find((message) => message.role === "assistant");
    return latestAssistant?.citations ?? [];
  }, [state.messages]);
  const showSources =
    state.sources.length > 0 || selectedDocumentIds.length > 0 || latestAssistantCitations.length > 0;

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((item) => item !== documentId)
        : [...current, documentId],
    );
  }

  const loadThread = useCallback(async (threadId: string) => {
    const response = await fetch(`/api/projects/${projectId}/assistant/threads/${threadId}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      error?: string;
      threadId?: string;
      messages?: AssistantMessageRecord[];
      sources?: AssistantSourceSelection[];
      runs?: AssistantRunRecord[];
    };

    if (!response.ok) {
      setError(payload.error ?? "Unable to load thread.");
      return;
    }

    setState((current) => ({
      ...current,
      activeThread: payload.threadId
        ? ({
            id: payload.threadId,
            title: current.activeThread?.title ?? "New query",
            threadType: "project_assistant",
            scanId: null,
            lastMessagePreview: current.messages.at(-1)?.content ?? null,
            lastMessageAt: current.messages.at(-1)?.createdAt ?? null,
            sourceCount: payload.sources?.length ?? 0,
          } satisfies AssistantThreadSummary)
        : current.activeThread,
      messages: payload.messages ?? current.messages,
      sources: payload.sources ?? current.sources,
      runs: payload.runs ?? current.runs,
    }));
    setSelectedDocumentIds(payload.sources?.map((source) => source.documentId) ?? []);
  }, [projectId]);

  const sendMessage = useCallback((params: {
    message: string;
    mode: "auto" | "draft" | "answer";
    selectedOutputType: "email" | "memo" | "summary" | "checklist" | null;
  }) => {
    const question = params.message.trim();
    if (!question) {
      return;
    }

    setError(null);
    const optimisticUserId = `tmp-user-${Date.now()}`;
    const optimisticAssistantId = `tmp-assistant-${Date.now()}`;
    setState((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: optimisticUserId,
          role: "user",
          content: question,
          createdAt: new Date().toISOString(),
          citations: [],
          metadata: {},
        },
        {
          id: optimisticAssistantId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          citations: [],
          metadata: {
            messageType: "system_progress",
            isPartial: true,
          },
        },
      ],
    }));

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/assistant/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThreadId ?? undefined,
          message: question,
          mode: params.mode,
          sourceDocumentIds: selectedDocumentIds,
          selectedOutputType: params.selectedOutputType,
        }),
      });
      const payload = (await response.json()) as { error?: string; threadId?: string; runId?: string };

      if (!response.ok || !payload.threadId || !payload.runId) {
        setError(payload.error ?? "Unable to send message.");
        setState((current) => ({
          ...current,
          messages: current.messages.filter(
            (message) => message.id !== optimisticUserId && message.id !== optimisticAssistantId,
          ),
        }));
        return;
      }

      setState((current) => ({
        ...current,
        activeThread: current.activeThread ?? {
          id: payload.threadId!,
          title: "New query",
          threadType: "project_assistant",
          scanId: null,
          lastMessagePreview: question,
          lastMessageAt: new Date().toISOString(),
          sourceCount: selectedDocumentIds.length,
        },
      }));

      activeEventSourceRef.current?.close();
      const eventSource = new EventSource(
        `/api/projects/${projectId}/assistant/runs/${payload.runId}/stream`,
      );
      activeEventSourceRef.current = eventSource;

      eventSource.addEventListener("token", (event) => {
        try {
          const data = JSON.parse(event.data) as { delta?: string };
          const delta = data.delta ?? "";
          if (!delta) {
            return;
          }
          setState((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === optimisticAssistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message,
            ),
          }));
        } catch {
          // noop
        }
      });

      eventSource.addEventListener("complete", async () => {
        eventSource.close();
        activeEventSourceRef.current = null;
        await loadThread(payload.threadId!);
      });

      eventSource.addEventListener("error", () => {
        eventSource.close();
        activeEventSourceRef.current = null;
        setError("Assistant stream failed.");
      });
    });
  }, [activeThreadId, loadThread, projectId, selectedDocumentIds]);

  useEffect(() => {
    if (!initialPrompt || state.messages.length) {
      return;
    }

    sendMessage({
      message: initialPrompt,
      mode: "auto",
      selectedOutputType: null,
    });
  }, [initialPrompt, sendMessage, state.messages.length]);

  useEffect(() => {
    return () => {
      activeEventSourceRef.current?.close();
      activeEventSourceRef.current = null;
    };
  }, []);

  return (
    <div className={`mx-auto grid max-w-7xl gap-6 ${showSources ? "xl:grid-cols-[1fr_300px]" : "grid-cols-1"}`}>
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5 pt-6">
            <AssistantComposer disabled={isPending} onSubmit={sendMessage} />
            {error ? (
              <p className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-red-600">{error}</p>
            ) : null}
          </CardContent>
        </Card>

        {state.messages.length ? (
          <Card>
            <CardContent className="pt-6">
              <ThreadTimeline isUpdating={isPending || hasPendingRun} messages={state.messages} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="grid gap-6 pt-6 md:grid-cols-3">
              {Object.entries(promptGroups).map(([group, prompts]) => (
                <div key={group}>
                  <h3 className="text-2xl font-semibold">{group}</h3>
                  <ul className="mt-4 space-y-3 text-base text-muted">
                    {prompts.map((prompt) => (
                      <li key={prompt}>
                        <button
                          className="text-left hover:text-text"
                          onClick={() =>
                            sendMessage({ message: prompt, mode: "auto", selectedOutputType: null })
                          }
                          type="button"
                        >
                          {prompt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {showSources ? (
        <div className="space-y-4">
          <SourceDrawer
            attachedSources={state.sources}
            citations={latestAssistantCitations}
            documents={indexedDocuments}
            onToggle={toggleDocument}
            selectedDocumentIds={selectedDocumentIds}
          />
        </div>
      ) : null}
    </div>
  );
}
