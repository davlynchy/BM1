"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantMode } from "@/types/assistant";

type PromptGroup = Record<string, readonly string[]>;

export type ComposerAttachment = {
  id: string;
  name: string;
  status: "uploading" | "queued" | "indexed" | "failed";
};

export function AssistantComposer({
  disabled,
  promptGroups,
  attachments,
  onSubmit,
  onFilesSelect,
  onPromptPick,
}: {
  disabled: boolean;
  promptGroups: PromptGroup;
  attachments: ComposerAttachment[];
  onSubmit: (params: {
    message: string;
    mode: AssistantMode;
    selectedOutputType: "email" | "memo" | "summary" | "checklist" | null;
  }) => void;
  onFilesSelect: (files: File[]) => void;
  onPromptPick: (prompt: string) => void;
}) {
  const [message, setMessage] = useState("");
  const mode: AssistantMode = "auto";
  const selectedOutputType: "email" | "memo" | "summary" | "checklist" | null = null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentSummary = useMemo(() => {
    if (!attachments.length) {
      return null;
    }
    const uploading = attachments.filter((item) => item.status === "uploading").length;
    const failed = attachments.filter((item) => item.status === "failed").length;
    if (uploading) {
      return `${uploading} uploading`;
    }
    if (failed) {
      return `${failed} failed`;
    }
    return `${attachments.length} attached`;
  }, [attachments]);

  useEffect(() => {
    if (!folderInputRef.current) {
      return;
    }
    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, []);

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
    <div className="space-y-3 rounded-[30px] border border-border bg-panel px-5 py-4">
      <Textarea
        disabled={disabled}
        className="min-h-[128px] rounded-2xl border-0 bg-transparent px-1 py-1 text-[18px] leading-7 text-text placeholder:text-muted/80 focus-visible:ring-0"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask anything about this project..."
        value={message}
      />
      {attachments.length ? (
        <div className="flex flex-wrap gap-2 px-2 text-xs">
          {attachments.slice(0, 8).map((attachment) => (
            <span className="rounded-full border border-border bg-bg px-3 py-1 text-muted" key={attachment.id}>
              {attachment.name}
            </span>
          ))}
          {attachments.length > 8 ? <span className="text-muted">+{attachments.length - 8} more</span> : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 px-1 pb-1">
        <div className="flex flex-wrap items-center gap-6 text-base text-muted">
          <button
            className="inline-flex items-center gap-2 hover:text-text"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip className="h-5 w-5" />
            Files
          </button>
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 hover:text-text">
              <Sparkles className="h-5 w-5" />
              Prompts
            </summary>
            <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-border bg-panel p-3 shadow-panel">
              {Object.entries(promptGroups).map(([group, prompts]) => (
                <div className="mb-3 last:mb-0" key={group}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{group}</p>
                  <div className="space-y-1">
                    {prompts.map((prompt) => (
                      <button
                        className="block w-full rounded-lg px-2 py-1 text-left text-sm text-text hover:bg-bg"
                        key={prompt}
                        onClick={() => onPromptPick(prompt)}
                        type="button"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
          {attachmentSummary ? <span className="text-sm">{attachmentSummary}</span> : null}
        </div>
        <Button className="rounded-xl text-base" disabled={disabled || !message.trim()} onClick={submit} size="lg" type="button">
          Ask
        </Button>
      </div>
      <input
        className="sr-only"
        multiple
        onChange={(event) => onFilesSelect(event.target.files ? Array.from(event.target.files) : [])}
        ref={fileInputRef}
        type="file"
      />
      <input
        className="sr-only"
        multiple
        onChange={(event) => onFilesSelect(event.target.files ? Array.from(event.target.files) : [])}
        ref={folderInputRef}
        type="file"
      />
    </div>
  );
}
