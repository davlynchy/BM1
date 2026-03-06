"use client";

import { useState } from "react";
import { Mic, Paperclip, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantMode } from "@/types/assistant";

export function AssistantComposer({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (params: {
    message: string;
    mode: AssistantMode;
    selectedOutputType: "email" | "memo" | "summary" | "checklist" | null;
  }) => void;
}) {
  const [message, setMessage] = useState("");
  const mode: AssistantMode = "auto";
  const selectedOutputType: "email" | "memo" | "summary" | "checklist" | null = null;

  function submit() {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    onSubmit({
      message: trimmed,
      mode,
      selectedOutputType,
    });
    setMessage("");
  }

  return (
    <div className="space-y-3 rounded-3xl border border-border bg-panel p-4">
      <Textarea
        disabled={disabled}
        className="min-h-[180px] rounded-2xl border-border bg-bg px-5 py-4 text-base leading-7 text-text placeholder:text-muted/80"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "enter") {
            event.preventDefault();
            submit();
          }
        }}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask anything about this project... (Ctrl/Cmd + Enter to send)"
        value={message}
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <div className="flex flex-wrap items-center gap-5 text-base text-muted">
          <button className="inline-flex items-center gap-2 hover:text-text" disabled={disabled} type="button">
            <Paperclip className="h-4 w-4" />
            Files
          </button>
          <button className="inline-flex items-center gap-2 hover:text-text" disabled={disabled} type="button">
            <Wand2 className="h-4 w-4" />
            Improve
          </button>
          <button className="inline-flex items-center gap-2 hover:text-text" disabled={disabled} type="button">
            <Sparkles className="h-4 w-4" />
            Prompts
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button className="rounded-xl" disabled={disabled || !message.trim()} onClick={submit} type="button">
            Ask
          </Button>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text"
            disabled={disabled}
            type="button"
          >
            <Mic className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
