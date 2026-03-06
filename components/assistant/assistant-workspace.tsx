"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AssistantComposer, type ComposerAttachment } from "@/components/assistant/assistant-composer";
import { PdfCitationViewer } from "@/components/assistant/pdf-citation-viewer";
import { ThreadList } from "@/components/assistant/thread-list";
import { ThreadTimeline } from "@/components/assistant/thread-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantMessageRecord, AssistantRunRecord, AssistantSourceSelection, AssistantThreadSummary } from "@/types/assistant";
import type { ProjectOutputRecord } from "@/types/outputs";
import type { UploadDescriptor, UploadManifestFile } from "@/types/uploads";
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

type RailTab = "sources" | "editor";

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
  userDisplayName,
}: {
  projectId: string;
  initialState: WorkspaceState;
  initialPrompt?: string | null;
  userDisplayName: string;
}) {
  const [state, setState] = useState(initialState);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(
    initialState.sources.map((source) => source.documentId),
  );
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [railTab, setRailTab] = useState<RailTab>("sources");
  const [selectedCitationOrder, setSelectedCitationOrder] = useState<number | null>(null);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null);
  const [editorOutput, setEditorOutput] = useState<ProjectOutputRecord | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [copyFeedbackByMessage, setCopyFeedbackByMessage] = useState<Record<string, string>>({});
  const [railWidthPercent, setRailWidthPercent] = useState(50);
  const [isPending, startTransition] = useTransition();
  const activeEventSourceRef = useRef<EventSource | null>(null);
  const splitterRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const activeThreadId = state.activeThread?.id ?? null;
  const hasPendingRun = useMemo(() => state.runs.some((run) => run.status !== "completed"), [state.runs]);
  const hasMessages = state.messages.length > 0;
  const latestAssistant = useMemo(
    () => [...state.messages].reverse().find((message) => message.role === "assistant") ?? null,
    [state.messages],
  );
  const sourceMessage = useMemo(() => {
    if (activeAssistantMessageId) {
      return state.messages.find((message) => message.id === activeAssistantMessageId && message.role === "assistant") ?? latestAssistant;
    }
    return latestAssistant;
  }, [activeAssistantMessageId, latestAssistant, state.messages]);
  const sourceCitations = useMemo(() => sourceMessage?.citations ?? [], [sourceMessage]);
  const sortedCitations = useMemo(() => {
    const withOrder = sourceCitations.map((citation, index) => ({
      ...citation,
      citationOrder: citation.citationOrder ?? index + 1,
    }));
    const deduped = new Map<number, (typeof withOrder)[number]>();
    withOrder.forEach((citation) => {
      if (!citation.citationOrder || deduped.has(citation.citationOrder)) {
        return;
      }
      deduped.set(citation.citationOrder, citation);
    });
    return [...deduped.values()].sort((a, b) => (a.citationOrder ?? 0) - (b.citationOrder ?? 0));
  }, [sourceCitations]);
  const selectedCitation = useMemo(
    () => (selectedCitationOrder ? sortedCitations.find((citation) => citation.citationOrder === selectedCitationOrder) ?? null : null),
    [selectedCitationOrder, sortedCitations],
  );
  const citationSearchPhrase = useMemo(() => {
    if (!selectedCitation?.snippet) {
      return "";
    }
    return selectedCitation.snippet.replace(/\s+/g, " ").trim().slice(0, 320);
  }, [selectedCitation]);
  const selectedCitationPage = selectedCitation?.page ?? selectedCitation?.pageNumber ?? 1;
  const selectedCitationSrc = selectedCitation
    ? `/api/projects/${projectId}/documents/${selectedCitation.documentId}/view`
    : null;
  const selectedIsPdf = (selectedCitation?.documentName ?? "").toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (!sortedCitations.length) {
      setSelectedCitationOrder(null);
      return;
    }

    if (!selectedCitationOrder) {
      setSelectedCitationOrder(sortedCitations[0]?.citationOrder ?? 1);
    }
  }, [selectedCitationOrder, sortedCitations]);

  const refreshThreads = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/assistant/threads`, { cache: "no-store" });
      const payload = (await response.json()) as {
        error?: string;
        threads?: AssistantThreadSummary[];
      };
      if (!response.ok) {
        return;
      }
      setState((current) => ({
        ...current,
        threads: payload.threads ?? current.threads,
      }));
    } catch {
      // noop
    }
  }, [projectId]);

  const loadThread = useCallback(async (threadId: string) => {
    try {
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
              title:
                current.activeThread?.id === payload.threadId
                  ? current.activeThread.title
                  : current.threads.find((thread) => thread.id === payload.threadId)?.title ?? "New chat",
              threadType: "project_assistant",
              scanId: null,
              lastMessagePreview: payload.messages?.at(-1)?.content ?? current.messages.at(-1)?.content ?? null,
              lastMessageAt: payload.messages?.at(-1)?.createdAt ?? current.messages.at(-1)?.createdAt ?? null,
              sourceCount: payload.sources?.length ?? 0,
            } satisfies AssistantThreadSummary)
          : current.activeThread,
        messages: payload.messages ?? current.messages,
        sources: payload.sources ?? current.sources,
        runs: payload.runs ?? current.runs,
      }));
      setSelectedDocumentIds(payload.sources?.map((source) => source.documentId) ?? []);
      await refreshThreads();
    } catch {
      setError("Unable to load thread. Check your connection and try again.");
    }
  }, [projectId, refreshThreads]);

  const streamRun = useCallback((params: { threadId: string; runId: string; optimisticAssistantId?: string }) => {
    activeEventSourceRef.current?.close();
    const eventSource = new EventSource(
      `/api/projects/${projectId}/assistant/runs/${params.runId}/stream`,
    );
    activeEventSourceRef.current = eventSource;

    eventSource.addEventListener("token", (event) => {
      try {
        const data = JSON.parse(event.data) as { delta?: string };
        const delta = data.delta ?? "";
        if (!delta) {
          return;
        }

        if (params.optimisticAssistantId) {
          setState((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === params.optimisticAssistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message,
            ),
          }));
        }
      } catch {
        // noop
      }
    });

    eventSource.addEventListener("complete", async () => {
      eventSource.close();
      activeEventSourceRef.current = null;
      await loadThread(params.threadId);
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
      activeEventSourceRef.current = null;
      setError("Assistant stream failed.");
    });
  }, [loadThread, projectId]);

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
      try {
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

        const threadId = payload.threadId;
        const runId = payload.runId;
        if (!threadId || !runId) {
          setError("Unable to send message.");
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
            id: threadId,
            title: "New chat",
            threadType: "project_assistant",
            scanId: null,
            lastMessagePreview: question,
            lastMessageAt: new Date().toISOString(),
            sourceCount: selectedDocumentIds.length,
          },
        }));

        streamRun({
          threadId,
          runId,
          optimisticAssistantId,
        });
      } catch {
        setError("Unable to send message. Check your connection and try again.");
        setState((current) => ({
          ...current,
          messages: current.messages.filter(
            (message) => message.id !== optimisticUserId && message.id !== optimisticAssistantId,
          ),
        }));
      }
    });
  }, [activeThreadId, projectId, selectedDocumentIds, streamRun]);

  const handleSelectThread = useCallback((threadId: string) => {
    setRailOpen(false);
    setActiveAssistantMessageId(null);
    setSelectedCitationOrder(null);
    void loadThread(threadId);
  }, [loadThread]);

  const startNewChat = useCallback(() => {
    setRailOpen(false);
    setActiveAssistantMessageId(null);
    setSelectedCitationOrder(null);
    setState((current) => ({
      ...current,
      activeThread: null,
      messages: [],
      sources: [],
      runs: [],
    }));
  }, []);

  const handleImprove = useCallback((messageId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/assistant/messages/${messageId}/improve`, {
          method: "POST",
        });
        const payload = (await response.json()) as { error?: string; threadId?: string; runId?: string; prompt?: string };
        if (!response.ok || !payload.threadId || !payload.runId) {
          setError(payload.error ?? "Unable to improve answer.");
          return;
        }

        setState((current) => ({
          ...current,
          messages: [
            ...current.messages,
            {
              id: `tmp-assistant-improve-${Date.now()}`,
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

        streamRun({ threadId: payload.threadId, runId: payload.runId });
      } catch {
        setError("Unable to improve answer.");
      }
    });
  }, [projectId, streamRun]);

  const uploadSingleFile = useCallback(async (
    selectedFile: {
      clientKey: string;
      file: File;
      relativePath: string | null;
    },
    descriptor: UploadDescriptor,
  ) => {
    const partNumbers = Array.from({ length: descriptor.partCount }, (_, index) => index + 1);
    const partResponse = await fetch(`/api/projects/${projectId}/uploads/part`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: descriptor.documentId,
        uploadId: descriptor.uploadId,
        partNumbers,
      }),
    });
    const partPayload = (await partResponse.json()) as {
      error?: string;
      parts?: Array<{ partNumber: number; url: string }>;
    };

    if (!partResponse.ok || !partPayload.parts) {
      throw new Error(partPayload.error ?? `Unable to sign ${selectedFile.file.name}.`);
    }

    const completedParts: Array<{ partNumber: number; etag: string }> = [];
    for (const part of partPayload.parts) {
      const start = (part.partNumber - 1) * descriptor.partSize;
      const end = Math.min(start + descriptor.partSize, selectedFile.file.size);
      const chunk = selectedFile.file.slice(start, end);
      const uploadResponse = await fetch(part.url, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.file.type || "application/octet-stream" },
        body: chunk,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Unable to upload ${selectedFile.file.name}.`);
      }

      const etag = uploadResponse.headers.get("etag") ?? uploadResponse.headers.get("ETag");
      if (!etag) {
        throw new Error(`Missing upload ETag for ${selectedFile.file.name}.`);
      }
      completedParts.push({
        partNumber: part.partNumber,
        etag,
      });
    }

    return {
      documentId: descriptor.documentId,
      uploadId: descriptor.uploadId,
      parts: completedParts,
    };
  }, [projectId]);

  const handleFilesSelect = useCallback((files: File[]) => {
    if (!files.length) {
      return;
    }

    const pendingUploads = files.map((file) => ({
      clientKey: crypto.randomUUID(),
      file,
      relativePath:
        ((file as File & { webkitRelativePath?: string }).webkitRelativePath || "").replace(/\\/g, "/") || null,
    }));

    setComposerAttachments((current) => [
      ...current,
      ...pendingUploads.map((file) => ({
        id: file.clientKey,
        name: file.relativePath ?? file.file.name,
        status: "uploading" as const,
      })),
    ]);

    startTransition(async () => {
      try {
        const manifest: UploadManifestFile[] = pendingUploads.map((file) => ({
          clientKey: file.clientKey,
          name: file.file.name,
          size: file.file.size,
          type: file.file.type,
          relativePath: file.relativePath,
        }));
        const response = await fetch(`/api/projects/${projectId}/uploads/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "vault",
            files: manifest,
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          batchId?: string;
          files?: UploadDescriptor[];
        };

        if (!response.ok || !payload.batchId || !payload.files) {
          throw new Error(payload.error ?? "Upload failed.");
        }

        const completedUploads: Array<{
          documentId: string;
          uploadId: string;
          parts: Array<{ partNumber: number; etag: string }>;
        }> = [];

        for (const descriptor of payload.files) {
          const selectedFile = pendingUploads.find((item) => item.clientKey === descriptor.clientKey);
          if (!selectedFile) {
            continue;
          }

          const completed = await uploadSingleFile(selectedFile, descriptor);
          completedUploads.push(completed);
        }

        if (completedUploads.length) {
          const completeResponse = await fetch(`/api/projects/${projectId}/uploads/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              batchId: payload.batchId,
              uploaded: completedUploads,
            }),
          });
          const completePayload = (await completeResponse.json()) as {
            error?: string;
            documents?: Array<{ id: string; name: string; parseStatus: string }>;
          };

          if (!completeResponse.ok) {
            throw new Error(completePayload.error ?? "Unable to finalize upload.");
          }

          const documentIds = (completePayload.documents ?? []).map((item) => item.id);
          if (documentIds.length) {
            setSelectedDocumentIds((current) => [...new Set([...current, ...documentIds])]);
          }
          setComposerAttachments((current) =>
            current.map((attachment) =>
              pendingUploads.some((item) => item.clientKey === attachment.id)
                ? { ...attachment, status: "queued" }
                : attachment,
            ),
          );
          const refreshThreadId = activeThreadId ?? state.activeThread?.id ?? null;
          if (refreshThreadId) {
            await loadThread(refreshThreadId);
          }
        }
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
        setError(message);
        setComposerAttachments((current) =>
          current.map((attachment) =>
            pendingUploads.some((item) => item.clientKey === attachment.id)
              ? { ...attachment, status: "failed" }
              : attachment,
          ),
        );
      }
    });
  }, [activeThreadId, loadThread, projectId, state.activeThread?.id, uploadSingleFile]);

  const handleCopy = useCallback(async (messageId: string) => {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message) {
      return;
    }
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyFeedbackByMessage((current) => ({ ...current, [messageId]: "Copied" }));
      setTimeout(() => {
        setCopyFeedbackByMessage((current) => ({ ...current, [messageId]: "" }));
      }, 1200);
    } catch {
      setError("Unable to copy response.");
    }
  }, [state.messages]);

  const handleShare = useCallback(async (messageId: string) => {
    const shareUrl = `${window.location.origin}/app/projects/${projectId}/assistant?threadId=${activeThreadId ?? ""}#m-${messageId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopyFeedbackByMessage((current) => ({ ...current, [messageId]: "Shared" }));
      setTimeout(() => {
        setCopyFeedbackByMessage((current) => ({ ...current, [messageId]: "" }));
      }, 1200);
    } catch {
      setError("Unable to share response.");
    }
  }, [activeThreadId, projectId]);

  const openEditor = useCallback((messageId: string) => {
    startTransition(async () => {
      try {
        setEditorError(null);
        const response = await fetch(`/api/projects/${projectId}/assistant/messages/${messageId}/output`, {
          method: "POST",
        });
        const payload = (await response.json()) as { error?: string; outputId?: string };
        if (!response.ok || !payload.outputId) {
          setEditorError(payload.error ?? "Unable to open editor.");
          return;
        }

        const outputResponse = await fetch(`/api/projects/${projectId}/outputs/${payload.outputId}`);
        const outputPayload = (await outputResponse.json()) as {
          error?: string;
          output?: ProjectOutputRecord;
        };
        if (!outputResponse.ok || !outputPayload.output) {
          setEditorError(outputPayload.error ?? "Unable to load output.");
          return;
        }

        setEditorOutput(outputPayload.output);
        setRailOpen(true);
        setRailTab("editor");
      } catch {
        setEditorError("Unable to open editor.");
      }
    });
  }, [projectId]);

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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("assistant-rail-toggle", {
        detail: {
          forceCollapsed: railOpen,
        },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("assistant-rail-toggle", {
          detail: {
            forceCollapsed: false,
          },
        }),
      );
    };
  }, [railOpen]);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!isResizingRef.current || !splitterRef.current) {
        return;
      }
      const rect = splitterRef.current.getBoundingClientRect();
      if (!rect.width) {
        return;
      }
      const next = ((rect.right - event.clientX) / rect.width) * 100;
      const clamped = Math.min(60, Math.max(32, next));
      setRailWidthPercent(clamped);
    }

    function onMouseUp() {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className={`h-full min-h-0 w-full ${railOpen ? "flex gap-0" : ""}`} ref={splitterRef}>
      <div
        className="flex min-h-0 flex-1 flex-col gap-4"
        style={railOpen ? { width: `${100 - railWidthPercent}%` } : undefined}
      >
        {!hasMessages ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">New chat</p>
              {state.activeThread ? (
                <Button className="h-8 px-3 text-xs" onClick={startNewChat} type="button" variant="secondary">
                  Start fresh
                </Button>
              ) : null}
            </div>
            <div className="w-full">
              <AssistantComposer
                attachments={composerAttachments}
                disabled={isPending}
                onFilesSelect={handleFilesSelect}
                onPromptPick={(prompt) => sendMessage({ message: prompt, mode: "auto", selectedOutputType: null })}
                onSubmit={sendMessage}
                promptGroups={promptGroups}
              />
            </div>
            {state.threads.length ? (
              <div className="space-y-2">
                <p className="pl-1 text-xs font-medium tracking-wide text-muted/80">Recent</p>
                <ThreadList
                  activeThreadId={activeThreadId}
                  onSelect={handleSelectThread}
                  threads={state.threads}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                Recent chats will appear here.
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between px-2">
              <p className="truncate text-sm font-medium text-muted">{state.activeThread?.title ?? "Current chat"}</p>
              <Button className="h-8 px-3 text-xs" onClick={startNewChat} type="button" variant="secondary">
                New chat
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-64">
                <ThreadTimeline
                  isUpdating={isPending || hasPendingRun}
                  messages={state.messages}
                  userDisplayName={userDisplayName}
                  onCitationDoubleClick={({ messageId, order }) => {
                    setActiveAssistantMessageId(messageId);
                    setSelectedCitationOrder(order);
                    setRailOpen(true);
                    setRailTab("sources");
                  }}
                  onCopy={handleCopy}
                  onImprove={handleImprove}
                  onOpenEditor={openEditor}
                  onShare={handleShare}
                />
            </div>
            <div className="sticky bottom-0 z-10 w-full border-t border-transparent bg-bg/95 px-2 pb-1 pt-3 backdrop-blur-sm">
              <div className="w-full space-y-3 rounded-3xl border border-border bg-white p-4">
                <AssistantComposer
                  attachments={composerAttachments}
                  disabled={isPending}
                  onFilesSelect={handleFilesSelect}
                  onPromptPick={(prompt) => sendMessage({ message: prompt, mode: "auto", selectedOutputType: null })}
                  onSubmit={sendMessage}
                  promptGroups={promptGroups}
                />
                {Object.values(copyFeedbackByMessage).some(Boolean) ? (
                  <p className="text-xs text-muted">{Object.values(copyFeedbackByMessage).find(Boolean)}</p>
                ) : null}
              </div>
            </div>
          </div>
        )}
        {error ? (
          <p className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-red-600">{error}</p>
        ) : null}
      </div>

      {railOpen ? (
        <div
          aria-label="Resize sources rail"
          className="group relative mx-1 hidden w-2 cursor-col-resize lg:block"
          onMouseDown={() => {
            isResizingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          role="separator"
        >
          <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-border transition group-hover:bg-muted" />
        </div>
      ) : null}

      {railOpen ? (
        <aside className="h-full min-h-0 rounded-3xl border border-border bg-panel p-4" style={{ width: `${railWidthPercent}%` }}>
          <div className="flex items-center gap-2 pb-3">
            <Button className="h-9 px-3 text-xs" onClick={() => setRailTab("sources")} type="button" variant={railTab === "sources" ? "default" : "secondary"}>
              Sources
            </Button>
            <Button className="h-9 px-3 text-xs" onClick={() => setRailTab("editor")} type="button" variant={railTab === "editor" ? "default" : "secondary"}>
              Editor
            </Button>
            <Button className="h-9 px-3 text-xs" onClick={() => setRailOpen(false)} type="button" variant="ghost">Close</Button>
          </div>

          {railTab === "sources" ? (
            <div className="h-[calc(100%-48px)] space-y-4 overflow-y-auto pr-1">
              {selectedCitation ? (
                <Card className="overflow-hidden">
                  <CardContent className="space-y-2 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {sortedCitations.map((citation) => {
                        const order = citation.citationOrder ?? 1;
                        return (
                          <button
                            className={`inline-flex min-w-5 items-center justify-center rounded-sm px-1 text-xs font-bold leading-5 ${selectedCitationOrder === order ? "bg-lime-500 text-black" : "bg-muted text-white"}`}
                            key={`${citation.documentId}-${order}`}
                            onClick={() => setSelectedCitationOrder(order)}
                            type="button"
                          >
                            {order}
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border-2 border-lime-500 bg-white p-2 text-sm text-text">
                      {selectedCitationSrc && selectedIsPdf ? (
                        <PdfCitationViewer
                          key={`${selectedCitation.documentId}-${selectedCitationOrder ?? "x"}-${selectedCitationPage}`}
                          pageNumber={selectedCitationPage}
                          searchPhrase={citationSearchPhrase}
                          src={selectedCitationSrc}
                          title={selectedCitation.documentName}
                        />
                      ) : (
                        <iframe
                          className="h-[820px] w-full rounded-lg border border-border bg-white"
                          key={`${selectedCitation?.documentId ?? "doc"}-${selectedCitationOrder ?? "x"}`}
                          src={`/api/projects/${projectId}/documents/${selectedCitation.documentId}/view#page=${selectedCitationPage}&zoom=page-width&search=${encodeURIComponent(citationSearchPhrase)}`}
                          title={selectedCitation.documentName}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : (
            <Card className="h-[calc(100%-48px)] overflow-y-auto">
              <CardContent className="space-y-3 pt-4">
                {editorOutput ? (
                  <>
                    <Textarea
                      className="min-h-[22rem]"
                      onChange={(event) => setEditorOutput((current) => (current ? { ...current, body: event.target.value } : current))}
                      value={editorOutput.body}
                    />
                    <Button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(editorOutput.body);
                        } catch {
                          setEditorError("Unable to copy editor text.");
                        }
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Copy
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted">Open an assistant response in Editor mode to start editing.</p>
                )}
                {editorError ? (
                  <p className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-red-600">{editorError}</p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </aside>
      ) : null}
    </div>
  );
}
