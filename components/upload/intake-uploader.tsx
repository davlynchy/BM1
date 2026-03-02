"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/ui/upload-dropzone";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822",
];

export function IntakeUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!file) {
      setError("Select a contract file to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/intake/upload", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { error?: string; redirectTo?: string };

    if (!response.ok || !payload.redirectTo) {
      setLoading(false);
      setError(payload.error ?? "Upload failed.");
      return;
    }

    window.location.href = payload.redirectTo;
  }

  return (
    <div className="space-y-5">
      <UploadDropzone
        acceptedTypes={ALLOWED_TYPES}
        onFileSelect={(nextFile) => {
          setFile(nextFile);
          setError(null);
        }}
      />
      {file ? (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
          Selected: <span className="font-medium text-text">{file.name}</span> ({(file.size / (1024 * 1024)).toFixed(1)} MB)
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={loading} onClick={handleSubmit} type="button">
          {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          Upload and continue
        </Button>
        <Link className="text-sm text-muted underline-offset-4 hover:underline" href="/login">
          Already have an account?
        </Link>
      </div>
    </div>
  );
}
