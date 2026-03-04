"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectOutputRecord, ProjectOutputVersion } from "@/types/outputs";

export function OutputEditor({
  projectId,
  initialOutput,
  versions,
}: {
  projectId: string;
  initialOutput: ProjectOutputRecord;
  versions: ProjectOutputVersion[];
}) {
  const [output, setOutput] = useState(initialOutput);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/outputs/${output.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: output.title,
          body: output.body,
          status: output.status,
        }),
      });
      const payload = (await response.json()) as { error?: string; output?: ProjectOutputRecord };

      if (!response.ok || !payload.output) {
        setError(payload.error ?? "Unable to save output.");
        return;
      }

      setOutput(payload.output);
    });
  }

  function rewrite() {
    if (!instruction.trim()) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/outputs/${output.id}/rewrite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instruction,
        }),
      });
      const payload = (await response.json()) as { error?: string; output?: ProjectOutputRecord };

      if (!response.ok || !payload.output) {
        setError(payload.error ?? "Unable to rewrite output.");
        return;
      }

      setOutput(payload.output);
      setInstruction("");
    });
  }

  function exportOutput(format: "txt" | "docx" | "pdf") {
    window.location.href = `/api/projects/${projectId}/outputs/${output.id}/export?format=${format}`;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <Input
          onChange={(event) => setOutput((current) => ({ ...current, title: event.target.value }))}
          value={output.title}
        />
        <Textarea
          className="min-h-[34rem]"
          onChange={(event) => setOutput((current) => ({ ...current, body: event.target.value }))}
          value={output.body}
        />
        {error ? (
          <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
            {error}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button disabled={isPending} onClick={save} type="button">
            Save version
          </Button>
          <Button disabled={isPending} onClick={() => exportOutput("txt")} type="button" variant="secondary">
            Export TXT
          </Button>
          <Button disabled={isPending} onClick={() => exportOutput("docx")} type="button" variant="secondary">
            Export DOCX
          </Button>
          <Button disabled={isPending} onClick={() => exportOutput("pdf")} type="button" variant="secondary">
            Export PDF
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-bg p-4">
          <p className="font-medium text-text">Rewrite</p>
          <Textarea
            className="mt-3 min-h-28"
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Make this firmer, shorter, or more client-facing."
            value={instruction}
          />
          <Button className="mt-3 w-full" disabled={isPending || !instruction.trim()} onClick={rewrite} type="button" variant="secondary">
            Rewrite with AI
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-bg p-4">
          <p className="font-medium text-text">Versions</p>
          <div className="mt-3 space-y-2">
            {versions.map((version) => (
              <div className="rounded-lg border border-border bg-panel px-3 py-2" key={version.id}>
                <p className="font-medium text-text">v{version.version}</p>
                <p className="mt-1 text-sm text-muted">{version.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
