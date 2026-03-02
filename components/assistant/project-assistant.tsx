"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantMessageRecord } from "@/types/assistant";

export function ProjectAssistant({
  projectId,
  initialThreadId,
  initialMessages,
}: {
  projectId: string;
  initialThreadId: string | null;
  initialMessages: AssistantMessageRecord[];
}) {
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [messages, setMessages] = useState<AssistantMessageRecord[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetThread() {
    setThreadId("__new__");
    setMessages([]);
    setError(null);
  }

  function handleSubmit() {
    const message = input.trim();

    if (!message) {
      return;
    }

    setError(null);
    setInput("");

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          message,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        threadId?: string;
        messages?: AssistantMessageRecord[];
      };

      if (!response.ok) {
        setError(payload.error ?? "Assistant request failed.");
        setInput(message);
        return;
      }

      setThreadId(payload.threadId ?? null);
      setMessages((current) => [...current, ...(payload.messages ?? [])]);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Project assistant</CardTitle>
          <p className="mt-2 text-sm text-muted">
            Ask grounded questions against indexed project documents and correspondence.
          </p>
        </div>
        <Button onClick={resetThread} size="sm" type="button" variant="secondary">
          New thread
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {messages.length ? (
            messages.map((message) => (
              <div
                className="rounded-xl border border-border bg-bg p-4"
                key={message.id}
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  {message.role}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-text">{message.content}</p>
                {message.citations.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.citations.map((citation) => (
                      <div
                        className="rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted"
                        key={`${message.id}-${citation.sourceId}`}
                      >
                        {citation.documentName}
                        {citation.pageNumber ? ` p.${citation.pageNumber}` : ""}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">
              Ask about liquidated damages, variation procedure, notice windows, or uploaded
              correspondence.
            </div>
          )}
        </div>
        <div className="space-y-3">
          <Textarea
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a project question..."
            value={input}
          />
          {error ? (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button disabled={isPending || !input.trim()} onClick={handleSubmit} type="button">
              {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
