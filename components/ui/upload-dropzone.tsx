"use client";

import * as React from "react";
import { FileUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function UploadDropzone({
  className,
  title = "Drag and drop your contract here",
  description = "Supports PDF, DOCX, XLSX, TXT, and EML.",
  variant = "default",
  acceptedTypes,
  multiple = false,
  allowFolders = false,
  fileButtonLabel = "Choose files",
  folderButtonLabel = "Choose folder",
  onFileSelect,
  onFilesSelect,
}: {
  className?: string;
  title?: string;
  description?: string;
  variant?: "default" | "marketing";
  acceptedTypes?: string[];
  multiple?: boolean;
  allowFolders?: boolean;
  fileButtonLabel?: string;
  folderButtonLabel?: string;
  onFileSelect?: (file: File | null) => void;
  onFilesSelect?: (files: File[]) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  function selectFile(fileList: FileList | null) {
    const nextFiles = fileList ? Array.from(fileList) : [];
    const nextFile = nextFiles[0] ?? null;
    onFileSelect?.(nextFile);
    onFilesSelect?.(nextFiles);
  }

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center text-center transition-colors",
        variant === "marketing"
          ? "min-h-52 rounded-[28px] border border-[#e2e6dc] bg-white px-6 py-10 shadow-[0_20px_50px_rgba(30,48,39,0.06)]"
          : "min-h-64 rounded-xl border border-dashed border-border bg-bg px-6 py-10",
        dragging && "border-brand bg-brand/5",
        className,
      )}
      onClick={() => fileInputRef.current?.click()}
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
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        accept={acceptedTypes?.join(",")}
        className="sr-only"
        multiple={multiple}
        onChange={(event) => selectFile(event.target.files)}
        type="file"
      />
      <input
        ref={folderInputRef}
        accept={acceptedTypes?.join(",")}
        className="sr-only"
        multiple
        onChange={(event) => selectFile(event.target.files)}
        type="file"
      />
      <div
        className={cn(
          "rounded-full",
          variant === "marketing"
            ? "bg-[#eff5e7] p-3 text-brand"
            : "bg-panel p-4 shadow-panel",
        )}
      >
        <FileUp className={cn("text-brand", variant === "marketing" ? "h-5 w-5" : "h-6 w-6")} />
      </div>
      <p
        className={cn(
          "text-text",
          variant === "marketing" ? "mt-4 text-lg font-semibold" : "mt-5 text-lg font-medium",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "max-w-md text-muted",
          variant === "marketing" ? "mt-2 text-sm" : "mt-2 text-sm",
        )}
      >
        {description}
      </p>
      {variant === "marketing" ? (
        <span className="mt-4 inline-flex rounded-full bg-[#f1f6ea] px-3 py-1 text-xs font-medium text-[#5d7a50]">
          First scan completely free
        </span>
      ) : (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            className="inline-flex rounded-full border border-border bg-panel px-4 py-2 text-sm font-medium"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
            type="button"
          >
            {fileButtonLabel}
          </button>
          {allowFolders ? (
            <button
              className="inline-flex rounded-full border border-border bg-panel px-4 py-2 text-sm font-medium"
              onClick={(event) => {
                event.stopPropagation();
                folderInputRef.current?.click();
              }}
              type="button"
            >
              {folderButtonLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
