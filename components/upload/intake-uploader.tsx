"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/ui/upload-dropzone";
import { ANONYMOUS_UPLOAD_THRESHOLD } from "@/lib/documents/upload-policy";

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

    setLoading(true);
    setError(null);

    try {
      const manifest = targetFiles.map((targetFile) => ({
        name: targetFile.name,
        size: targetFile.size,
        type: targetFile.type,
        relativePath:
          ((targetFile as File & { webkitRelativePath?: string }).webkitRelativePath || "")
            .replace(/\\/g, "/") || null,
      }));
      const startResponse = await fetch("/api/intake/large-upload/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: manifest,
        }),
      });
      const startPayload = (await startResponse.json().catch(() => ({}))) as {
        error?: string;
        mode?: "anonymous" | "requires_auth";
        redirectTo?: string | null;
      };

      if (!startResponse.ok || !startPayload.mode) {
        setLoading(false);
        setError(startPayload.error ?? "Unable to start upload.");
        return;
      }

      if (startPayload.mode === "requires_auth") {
        sessionStorage.setItem("bidmetric_intake_manifest", JSON.stringify(manifest));
        window.location.href = startPayload.redirectTo ?? "/signup?next=%2Fupload";
        return;
      }

      const formData = new FormData();
      formData.append("file", targetFiles[0]);

      const response = await fetch("/api/intake/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || !payload.redirectTo) {
        setLoading(false);
        setError(payload.error ?? "Upload failed.");
        return;
      }

      window.location.href = payload.redirectTo;
    } catch {
      setLoading(false);
      setError("Upload failed. Check the dev server and try again.");
    }
  }, [files]);

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const requiresAuth =
    files.length > 1 ||
    files.some(
      (file) =>
        file.size > ANONYMOUS_UPLOAD_THRESHOLD ||
        Boolean((file as File & { webkitRelativePath?: string }).webkitRelativePath),
    );

  return (
    <div className="space-y-5">
      <UploadDropzone
        acceptedTypes={ALLOWED_TYPES}
        allowFolders
        className={compact ? "min-h-52" : undefined}
        fileButtonLabel="Choose contract"
        folderButtonLabel="Choose folder"
        multiple
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
              ? "Small single-file uploads can start immediately. Large files and folders require an account."
              : undefined
        }
        title={variant === "marketing" ? "Drop your contract here" : autoUpload ? "Drop your contract to start instantly" : undefined}
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
          {requiresAuth ? (
            <p className="mt-2">
              Files over 25MB, multiple files, and folder uploads require login before transfer begins.
            </p>
          ) : null}
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
              ? "Free summary for small files now. Large files and folders continue after login."
              : "Free summary for small files now. Large files and folders continue after login."}
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
