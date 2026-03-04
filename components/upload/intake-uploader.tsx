"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/ui/upload-dropzone";
import { AUTHENTICATED_FILE_SIZE_LIMIT } from "@/lib/documents/upload-policy";
import { saveIntakeFile } from "@/lib/intake/browser-file-cache";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822",
];

export function IntakeUploader({
  autoUpload = false,
  compact = false,
  variant = "default",
}: {
  autoUpload?: boolean;
  compact?: boolean;
  variant?: "default" | "marketing";
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (selectedFiles?: File[]) => {
    const targetFiles = selectedFiles ?? files;

    if (!targetFiles.length) {
      setError("Select a contract file to continue.");
      return;
    }

    if (
      targetFiles.length !== 1 ||
      Boolean((targetFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath)
    ) {
      setError("Public intake supports one contract at a time. Sign in first to upload folders or multiple files.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const file = targetFiles[0];
      const createResponse = await fetch("/api/intake/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            relativePath:
              ((file as File & { webkitRelativePath?: string }).webkitRelativePath || "").replace(/\\/g, "/") || null,
          },
        }),
      });
      const createPayload = (await createResponse.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
        sessionId?: string;
      };

      if (!createResponse.ok || !createPayload.redirectTo || !createPayload.sessionId) {
        setLoading(false);
        setError(createPayload.error ?? "Unable to start upload.");
        return;
      }

      try {
        await saveIntakeFile(createPayload.sessionId, file);
      } catch {
        // Browser storage is best-effort. If it fails, the intake page will ask for reattachment.
      }
      window.location.href = createPayload.redirectTo;
    } catch {
      setLoading(false);
      setError("Upload failed. Check the dev server and try again.");
    }
  }, [files]);

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const maxSizeInGb = Math.floor(AUTHENTICATED_FILE_SIZE_LIMIT / (1024 * 1024 * 1024));

  return (
    <div className="space-y-5">
      <UploadDropzone
        acceptedTypes={ALLOWED_TYPES}
        allowFolders={false}
        className={compact ? "min-h-52" : undefined}
        fileButtonLabel="Choose contract"
        multiple={false}
        onFilesSelect={(nextFiles) => {
          setFiles(nextFiles);
          setError(null);

          if (autoUpload && nextFiles.length) {
            void handleSubmit(nextFiles);
          }
        }}
        description={
          variant === "marketing"
            ? "PDF, Word or Excel"
            : autoUpload
              ? "Choose one contract to continue into login or signup, then assign it to a project."
              : undefined
        }
        title={variant === "marketing" ? "Drop your contract here" : autoUpload ? "Drop your contract to continue" : undefined}
        variant={variant === "marketing" ? "marketing" : "default"}
      />
      {files.length ? (
        <div
          className={
            variant === "marketing"
              ? "rounded-2xl border border-[#e2e6dc] bg-[#fbfcf8] px-4 py-3 text-sm text-muted"
              : "rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted"
          }
        >
          {loading ? "Preparing upload" : "Selected"}: {files.length} file{files.length === 1 ? "" : "s"} ({(totalBytes / (1024 * 1024)).toFixed(1)} MB)
          <p className="mt-2">
            Public intake supports one contract at a time, up to {maxSizeInGb}GB. Upload continues after login or signup.
          </p>
        </div>
      ) : null}
      {error ? (
        <div
          className={
            variant === "marketing"
              ? "rounded-2xl border border-[#e2e6dc] bg-[#fbfcf8] px-4 py-3 text-sm text-muted"
              : "rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted"
          }
        >
          {error}
        </div>
      ) : null}
      {autoUpload ? (
        <div
          className={
            variant === "marketing"
              ? "flex flex-wrap items-center justify-center gap-3 text-sm text-[#6d796f]"
              : "flex flex-wrap items-center gap-3 text-sm text-muted"
          }
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          <span>
            {variant === "marketing"
              ? "Continue to save this contract to a project and run the scan."
              : "Continue to save this contract to a project and run the scan."}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={loading} onClick={() => void handleSubmit()} type="button">
            {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Upload and continue
          </Button>
          <Link className="text-sm text-muted underline-offset-4 hover:underline" href="/login">
            Already have an account?
          </Link>
        </div>
      )}
    </div>
  );
}
