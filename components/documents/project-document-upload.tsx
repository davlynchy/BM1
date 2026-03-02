"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/ui/upload-dropzone";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822",
];

export function ProjectDocumentUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleUpload() {
    if (!files.length) {
      setError("Select one or more files to upload.");
      return;
    }

    setError(null);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await fetch(`/api/projects/${projectId}/documents/upload`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Upload failed.");
      return;
    }

    setFiles([]);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <UploadDropzone
        acceptedTypes={ACCEPTED_TYPES}
        multiple
        onFilesSelect={(nextFiles) => {
          setFiles(nextFiles);
          setError(null);
        }}
        title="Drop project documents here"
        description="PDF, DOCX, XLSX, TXT, and EML files are supported. Scanned PDFs are not yet supported."
      />
      {files.length ? (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
          {files.length} file{files.length === 1 ? "" : "s"} selected.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
          {error}
        </div>
      ) : null}
      <div className="flex gap-3">
        <Button disabled={isPending} onClick={handleUpload} type="button">
          {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          Upload documents
        </Button>
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
