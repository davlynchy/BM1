"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { clearIntakeFile, getIntakeFile } from "@/lib/intake/browser-file-cache";
import type {
  IntakeCompletedPart,
  IntakeSession,
  IntakeUploadDescriptor,
  IntakeUploadState,
} from "@/types/intake";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

type ProjectOption = {
  id: string;
  name: string;
  createdAt: string;
};

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSessionUploadState(session: IntakeSession): IntakeUploadState | null {
  const value = session.metadata?.uploadState;
  return value === "created" || value === "uploading" || value === "uploaded" || value === "failed"
    ? value
    : null;
}

export function IntakeSessionPage({
  session,
  projects,
}: {
  session: IntakeSession;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasProjects = projects.length > 0;
  const uploadCompleted = getSessionUploadState(session) === "uploaded" && Boolean(session.storage_path);
  const [mode, setMode] = useState<"create_new" | "existing">(
    session.project_selection_mode === "existing" && hasProjects ? "existing" : "create_new",
  );
  const [projectName, setProjectName] = useState(session.new_project_name ?? "");
  const [projectId, setProjectId] = useState(session.project_id ?? projects[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [hasRecoveredFile, setHasRecoveredFile] = useState(uploadCompleted);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(uploadCompleted ? 100 : 0);
  const [submitLabel, setSubmitLabel] = useState("Continue to scan");

  useEffect(() => {
    if (uploadCompleted) {
      return;
    }

    let cancelled = false;

    void getIntakeFile(session.id)
      .then((cachedFile) => {
        if (!cancelled && cachedFile) {
          setFile(cachedFile);
          setHasRecoveredFile(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasRecoveredFile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session.id, uploadCompleted]);

  async function uploadContractDirect(fileToUpload: File) {
    const descriptorResponse = await fetch(`/api/intake/session/${session.id}/upload/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientKey: "intake-contract",
      }),
    });
    const descriptorPayload = (await descriptorResponse.json().catch(() => ({}))) as
      | ({ error?: string } & Partial<IntakeUploadDescriptor>)
      | undefined;

    if (
      !descriptorResponse.ok ||
      !descriptorPayload ||
      !descriptorPayload.documentId ||
      !descriptorPayload.uploadId ||
      !descriptorPayload.partCount ||
      !descriptorPayload.partSize
    ) {
      throw new Error(descriptorPayload?.error ?? "Unable to start contract upload.");
    }

    const descriptor = descriptorPayload as IntakeUploadDescriptor;
    const partNumbers = Array.from({ length: descriptor.partCount }, (_, index) => index + 1);
    const partResponse = await fetch(`/api/intake/session/${session.id}/upload/part`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: descriptor.documentId,
        uploadId: descriptor.uploadId,
        partNumbers,
      }),
    });
    const partPayload = (await partResponse.json().catch(() => ({}))) as {
      error?: string;
      parts?: Array<{ partNumber: number; url: string }>;
    };

    if (!partResponse.ok || !partPayload.parts) {
      throw new Error(partPayload.error ?? "Unable to prepare contract upload.");
    }

    const completedParts: IntakeCompletedPart[] = [];
    setSubmitLabel("Uploading contract...");
    setProgress(0);

    for (const part of partPayload.parts) {
      const start = (part.partNumber - 1) * descriptor.partSize;
      const end = Math.min(start + descriptor.partSize, fileToUpload.size);
      const chunk = fileToUpload.slice(start, end);
      const uploadResponse = await fetch(part.url, {
        method: "PUT",
        headers: {
          "Content-Type": fileToUpload.type || "application/octet-stream",
        },
        body: chunk,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Unable to upload ${fileToUpload.name}.`);
      }

      const etag = uploadResponse.headers.get("etag") ?? uploadResponse.headers.get("ETag");
      if (!etag) {
        throw new Error(`Missing upload ETag for ${fileToUpload.name}.`);
      }

      completedParts.push({
        partNumber: part.partNumber,
        etag,
      });
      setProgress(Math.round((completedParts.length / descriptor.partCount) * 100));
    }

    const completeResponse = await fetch(`/api/intake/session/${session.id}/upload/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: descriptor.documentId,
        uploadId: descriptor.uploadId,
        parts: completedParts,
      }),
    });
    const completePayload = (await completeResponse.json().catch(() => ({}))) as { error?: string };

    if (!completeResponse.ok) {
      throw new Error(completePayload.error ?? "Unable to finalize contract upload.");
    }

    setProgress(100);
  }

  async function handleContinue() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      setSubmitLabel("Saving project...");
      const projectResponse = await fetch(`/api/intake/session/${session.id}/assign-project`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          mode === "existing"
            ? { mode, projectId }
            : { mode, projectName },
        ),
      });
      const projectPayload = (await projectResponse.json().catch(() => ({}))) as { error?: string };

      if (!projectResponse.ok) {
        setError(projectPayload.error ?? "Choose where this contract should live.");
        return;
      }

      if (!uploadCompleted) {
        if (!file) {
          setError("Reattach the same contract to continue.");
          return;
        }

        if (
          file.name !== session.file_name ||
          file.size !== session.file_size ||
          file.type !== session.mime_type
        ) {
          setError("Reattach the same contract you selected before login.");
          return;
        }

        await uploadContractDirect(file);
      }

      setSubmitLabel("Finalizing scan...");
      const finalizeResponse = await fetch(`/api/intake/session/${session.id}/finalize`, {
        method: "POST",
      });
      const finalizePayload = (await finalizeResponse.json().catch(() => ({}))) as {
        error?: string;
        scanId?: string;
      };

      if (!finalizeResponse.ok || !finalizePayload.scanId) {
        setError(finalizePayload.error ?? "Unable to continue to the scan.");
        return;
      }

      await clearIntakeFile(session.id).catch(() => undefined);
      router.push(`/scan/${finalizePayload.scanId}`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to continue to the scan.");
    } finally {
      setSubmitLabel("Continue to scan");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <h1 className="font-heading text-4xl">Contract Intake</h1>
          <p className="text-muted">
            Your contract is locked in. Next, choose the project workspace where this scan belongs.
          </p>
        </div>

        <Card className="border-border/80 bg-panel/60">
          <CardHeader>
            <CardTitle>Selected contract</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-4">
            <div>
              <p className="font-medium text-text">File</p>
              <p>{session.file_name}</p>
            </div>
            <div>
              <p className="font-medium text-text">Size</p>
              <p>{formatSize(session.file_size)}</p>
            </div>
            <div>
              <p className="font-medium text-text">Status</p>
              <p>
                {uploadCompleted
                  ? "Attached"
                  : hasRecoveredFile
                    ? "Ready to upload"
                    : "Reattach required"}
              </p>
            </div>
            <div>
              <p className="font-medium text-text">Access</p>
              <p>Preview if unsubscribed, full report if subscribed.</p>
            </div>
          </CardContent>
        </Card>

        <Modal
          description="Save this contract to a project, then continue straight to the scan."
          onClose={() => router.push("/upload")}
          open
          title="Choose where this contract lives"
        >
          <div className="space-y-6">
            {error ? (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                {error}
              </div>
            ) : null}

            {hasProjects ? (
              <div className="flex flex-wrap gap-3">
                <button
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${
                    mode === "create_new" ? "border-brand bg-brand/10 text-text" : "border-border bg-bg text-muted"
                  }`}
                  onClick={() => setMode("create_new")}
                  type="button"
                >
                  Create new project
                </button>
                <button
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${
                    mode === "existing" ? "border-brand bg-brand/10 text-text" : "border-border bg-bg text-muted"
                  }`}
                  onClick={() => setMode("existing")}
                  type="button"
                >
                  Use existing project
                </button>
              </div>
            ) : null}

            {mode === "create_new" || !hasProjects ? (
              <div className="space-y-2">
                <Label htmlFor="projectName">Project name</Label>
                <Input
                  id="projectName"
                  name="projectName"
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Perth Towers East"
                  value={projectName}
                />
                <p className="text-sm text-muted">
                  This is the workspace where the contract and future scan results will live.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Choose an existing project</Label>
                <div className="grid gap-3">
                  {projects.map((project) => (
                    <label
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        projectId === project.id ? "border-brand bg-brand/5" : "border-border bg-bg"
                      }`}
                      key={project.id}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          checked={projectId === project.id}
                          className="mt-1"
                          name="projectId"
                          onChange={() => setProjectId(project.id)}
                          type="radio"
                          value={project.id}
                        />
                        <div>
                          <p className="font-medium text-text">{project.name}</p>
                          <p className="text-muted">
                            Created {new Date(project.createdAt).toLocaleDateString("en-AU")}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!uploadCompleted ? (
              <div className="space-y-3 rounded-xl border border-border bg-bg px-4 py-4">
                <Label htmlFor="reattach">
                  {hasRecoveredFile ? "Contract ready" : "Reattach contract"}
                </Label>
                {file ? (
                  <div className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-muted">
                    {file.name} ({formatSize(file.size)})
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    If this browser still has the file cached, it will upload automatically. Otherwise,
                    choose the same contract again.
                  </p>
                )}
                <input
                  accept={session.mime_type}
                  className="hidden"
                  id="reattach"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    variant="secondary"
                  >
                    {file ? "Choose different file" : "Choose contract"}
                  </Button>
                </div>
              </div>
            ) : null}

            {isSubmitting && !uploadCompleted ? (
              <div className="space-y-2 rounded-xl border border-border bg-bg px-4 py-4">
                <div className="flex items-center justify-between gap-3 text-sm text-muted">
                  <span>{submitLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-border">
                  <div
                    className="h-2 rounded-full bg-brand transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <Link className="text-sm text-muted underline-offset-4 hover:underline" href="/upload">
                Start over
              </Link>
              <Button
                disabled={isSubmitting}
                onClick={() => void handleContinue()}
                type="button"
              >
                {isSubmitting ? submitLabel : "Continue to scan"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}
