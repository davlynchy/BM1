"use client";

import { useState } from "react";

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
  const [mode, setMode] = useState<AssistantMode>("auto");
  const [selectedOutputType, setSelectedOutputType] = useState<"email" | "memo" | "summary" | "checklist" | null>(null);

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
    <div className="space-y-3 rounded-2xl border border-border bg-panel p-4">
      <Textarea
        disabled={disabled}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask anything about the files in this project..."
        value={message}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["auto", "draft", "answer"] as const).map((value) => (
            <Button
              disabled={disabled}
              key={value}
              onClick={() => setMode(value)}
              size="sm"
              type="button"
              variant={mode === value ? "default" : "secondary"}
            >
              {value}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["email", "memo", "summary", "checklist"] as const).map((value) => (
            <Button
              disabled={disabled}
              key={value}
              onClick={() => setSelectedOutputType(selectedOutputType === value ? null : value)}
              size="sm"
              type="button"
              variant={selectedOutputType === value ? "default" : "secondary"}
            >
              {value}
            </Button>
          ))}
          <Button disabled={disabled || !message.trim()} onClick={submit} type="button">
            Ask Bidmetric
          </Button>
        </div>
      </div>
    </div>
  );
}
