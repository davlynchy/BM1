"use client";

import * as React from "react";
import { FileUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function UploadDropzone({
  className,
  title = "Drag and drop your contract here",
  description = "Supports PDF, DOCX, XLSX, TXT, and EML.",
  acceptedTypes,
  multiple = false,
  onFileSelect,
  onFilesSelect,
}: {
  className?: string;
  title?: string;
  description?: string;
  acceptedTypes?: string[];
  multiple?: boolean;
  onFileSelect?: (file: File | null) => void;
  onFilesSelect?: (files: File[]) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function selectFile(fileList: FileList | null) {
    const nextFiles = fileList ? Array.from(fileList) : [];
    const nextFile = nextFiles[0] ?? null;
    onFileSelect?.(nextFile);
    onFilesSelect?.(nextFiles);
  }

  return (
    <label
      className={cn(
        "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg px-6 py-10 text-center transition-colors",
        dragging && "border-brand bg-brand/5",
        className,
      )}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        selectFile(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        accept={acceptedTypes?.join(",")}
        className="sr-only"
        multiple={multiple}
        onChange={(event) => selectFile(event.target.files)}
        type="file"
      />
      <div className="rounded-full bg-panel p-4 shadow-panel">
        <FileUp className="h-6 w-6 text-brand" />
      </div>
      <p className="mt-5 text-lg font-medium text-text">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      <span className="mt-5 inline-flex rounded-full border border-border bg-panel px-4 py-2 text-sm font-medium">
        Choose files
      </span>
    </label>
  );
}
