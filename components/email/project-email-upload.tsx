"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { UploadDropzone } from "@/components/ui/upload-dropzone";

export function ProjectEmailUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    if (!files.length) {
      setError("Select one or more files.");
      setMessage(null);
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("documentType", "email");
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string; documents?: Array<{ id: string }> };
      if (!response.ok) {
        setError(payload.error ?? "Upload failed.");
        return;
      }

      setMessage(`${payload.documents?.length ?? files.length} email file(s) uploaded and queued.`);
      router.refresh();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <UploadDropzone
        acceptedTypes={[".eml", "message/rfc822"]}
        className="min-h-40 rounded-2xl"
        description="Drag and drop .eml files from Outlook, or click to upload."
        fileButtonLabel={uploading ? "Uploading..." : "Upload .eml"}
        multiple
        onFilesSelect={handleFiles}
        title="Drop email files here"
      />
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
