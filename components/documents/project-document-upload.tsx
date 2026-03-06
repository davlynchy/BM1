"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, RefreshCcw, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/ui/upload-dropzone";
import type { UploadDescriptor, UploadManifestFile } from "@/types/uploads";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822",
];

export function ProjectDocumentUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<
    Array<{
      clientKey: string;
      file: File;
      relativePath: string | null;
      status: "ready" | "uploading" | "queued" | "failed";
      progress: number;
      error: string | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function uploadSingleFile(
    selectedFile: (typeof files)[number],
    descriptor: UploadDescriptor,
  ) {
    const partNumbers = Array.from({ length: descriptor.partCount }, (_, index) => index + 1);
    const partResponse = await fetch(`/api/projects/${projectId}/uploads/part`, {
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
        headers: {
          "Content-Type": selectedFile.file.type || "application/octet-stream",
        },
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

      setFiles((current) =>
        current.map((file) =>
          file.clientKey === selectedFile.clientKey
            ? {
                ...file,
                progress: Math.round((completedParts.length / descriptor.partCount) * 100),
              }
            : file,
        ),
      );
    }

    return {
      documentId: descriptor.documentId,
      uploadId: descriptor.uploadId,
      parts: completedParts,
    };
  }

  async function handleUpload(clientKeys?: string[]) {
    const targetFiles = files.filter((file) =>
      clientKeys?.length
        ? clientKeys.includes(file.clientKey)
        : file.status === "ready" || file.status === "failed",
    );

    if (!targetFiles.length) {
      setError("Select one or more files to upload.");
      return;
    }

    setError(null);
    setFiles((current) =>
      current.map((file) =>
        targetFiles.some((target) => target.clientKey === file.clientKey)
          ? {
              ...file,
              status: "uploading",
              progress: 0,
              error: null,
            }
          : file,
      ),
    );

    const manifest: UploadManifestFile[] = targetFiles.map((file) => ({
      clientKey: file.clientKey,
      name: file.file.name,
      size: file.file.size,
      type: file.file.type,
      relativePath: file.relativePath,
    }));
    const response = await fetch(`/api/projects/${projectId}/uploads/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
      setError(payload.error ?? "Upload failed.");
      setFiles((current) =>
        current.map((file) =>
          targetFiles.some((target) => target.clientKey === file.clientKey)
            ? { ...file, status: "failed", error: payload.error ?? "Upload failed." }
            : file,
        ),
      );
      return;
    }

    const completedUploads: Array<{
      documentId: string;
      uploadId: string;
      parts: Array<{ partNumber: number; etag: string }>;
    }> = [];

    for (const descriptor of payload.files) {
      const selectedFile = targetFiles.find((file) => file.clientKey === descriptor.clientKey);

      if (!selectedFile) {
        continue;
      }

      try {
        const completed = await uploadSingleFile(selectedFile, descriptor);
        completedUploads.push(completed);
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
        setFiles((current) =>
          current.map((file) =>
            file.clientKey === selectedFile.clientKey
              ? { ...file, status: "failed", error: message }
              : file,
          ),
        );
      }
    }

    if (completedUploads.length) {
      const completeResponse = await fetch(`/api/projects/${projectId}/uploads/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchId: payload.batchId,
          uploaded: completedUploads,
        }),
      });
      const completePayload = (await completeResponse.json()) as {
        error?: string;
        assistantUrl?: string | null;
      };

      if (!completeResponse.ok) {
        setError(completePayload.error ?? "Unable to finalize upload.");
      } else if (completePayload.assistantUrl) {
        window.location.href = completePayload.assistantUrl;
        return;
      }
    }

    setFiles((current) =>
      current
        .map((file) => {
          const targeted = targetFiles.some((target) => target.clientKey === file.clientKey);
          if (!targeted || file.status === "failed") {
            return file;
          }

          return {
            ...file,
            status: "queued" as const,
            progress: 100,
          };
        })
        .filter((file) => file.status === "failed"),
    );
    startTransition(() => {
      router.refresh();
    });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.file.size, 0);
  const failedFiles = files.filter((file) => file.status === "failed");

  return (
    <div className="space-y-4">
      <UploadDropzone
        acceptedTypes={ACCEPTED_TYPES}
        allowFolders
        fileButtonLabel="Choose files"
        folderButtonLabel="Choose folder"
        multiple
        onFilesSelect={(nextFiles) => {
          setFiles(
            nextFiles.map((file) => ({
              clientKey: crypto.randomUUID(),
              file,
              relativePath:
                ((file as File & { webkitRelativePath?: string }).webkitRelativePath || "")
                  .replace(/\\/g, "/") || null,
              status: "ready",
              progress: 0,
              error: null,
            })),
          );
          setError(null);
        }}
        title="Drop project documents here"
        description="PDF, DOCX, XLSX, TXT, and EML files are supported. Folder uploads preserve relative paths."
      />
      {files.length ? (
        <div className="space-y-3 rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
          <p>
            {files.length} file{files.length === 1 ? "" : "s"} selected, {(totalBytes / (1024 * 1024)).toFixed(1)} MB total.
          </p>
          <div className="space-y-2">
            {files.slice(0, 8).map((file) => (
              <div className="rounded-lg border border-border bg-panel px-3 py-2" key={file.clientKey}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text">{file.relativePath ?? file.file.name}</p>
                    <p>{file.status}</p>
                  </div>
                  <p>{file.progress}%</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-border">
                  <div
                    className="h-2 rounded-full bg-brand transition-all"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
                {file.error ? <p className="mt-2 text-xs text-destructive">{file.error}</p> : null}
              </div>
            ))}
            {files.length > 8 ? <p>Showing 8 of {files.length} files.</p> : null}
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
          {error}
        </div>
      ) : null}
      <div className="flex gap-3">
        <Button disabled={isPending} onClick={() => void handleUpload()} type="button">
          {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          Upload documents
        </Button>
        {failedFiles.length ? (
          <Button
            disabled={isPending}
            onClick={() => void handleUpload(failedFiles.map((file) => file.clientKey))}
            type="button"
            variant="secondary"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry failed
          </Button>
        ) : null}
        <Button
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
          type="button"
          variant="secondary"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh status
        </Button>
      </div>
    </div>
  );
}
