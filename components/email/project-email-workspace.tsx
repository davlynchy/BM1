"use client";

import { useMemo, useState } from "react";
import { FolderPlus, Filter, Share2, Upload } from "lucide-react";

import { RetryDocumentButton } from "@/components/documents/retry-document-button";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { ProjectEmailUpload } from "@/components/email/project-email-upload";
import { Button } from "@/components/ui/button";
import type { DocumentParseStatus } from "@/types/ingestion";

type EmailRecord = {
  id: string;
  sender: string | null;
  subject: string | null;
  receivedAt: string | null;
  bodyText: string | null;
  metadata: Record<string, unknown> | null;
  routingStatus: string | null;
  routingConfidence: number | null;
};

type EmailDocumentRecord = {
  id: string;
  name: string;
  parseStatus: string;
  processingError: string | null;
  createdAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function attachmentLabels(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return [];
  }
  const attachments = metadata.attachments;
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== "object") {
        return null;
      }
      const filename = "filename" in attachment ? attachment.filename : null;
      return typeof filename === "string" ? filename : null;
    })
    .filter((value): value is string => Boolean(value));
}

export function ProjectEmailWorkspace({
  projectId,
  emails,
  emailDocuments,
}: {
  projectId: string;
  emails: EmailRecord[];
  emailDocuments: EmailDocumentRecord[];
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(emails[0]?.id ?? null);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? null,
    [emails, selectedEmailId],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-border bg-panel p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3">
          <Button className="rounded-xl" type="button" variant="secondary">
            <FolderPlus className="mr-2 h-4 w-4" />
            Create folder
          </Button>
          <Button className="rounded-xl" type="button" variant="secondary">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button className="rounded-xl" type="button" variant="secondary">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button className="rounded-xl bg-black text-white hover:bg-black/90" onClick={() => setShowUpload((value) => !value)} type="button">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>

        {showUpload ? (
          <div className="mb-6 rounded-2xl border border-border bg-bg p-3">
            <ProjectEmailUpload projectId={projectId} />
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-border bg-bg">
            <div className="border-b border-border px-4 py-3">
              <p className="text-lg font-semibold text-text">Emails</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="border-b border-border text-sm text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">From</th>
                    <th className="px-3 py-2 font-medium">Subject</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => {
                    const selected = selectedEmailId === email.id;
                    return (
                      <tr
                        className={`cursor-pointer border-b border-border/60 text-sm ${selected ? "bg-panel" : "hover:bg-panel/70"}`}
                        key={email.id}
                        onClick={() => setSelectedEmailId(email.id)}
                      >
                        <td className="px-3 py-3">{email.sender || "Unknown"}</td>
                        <td className="px-3 py-3 font-medium text-text">{email.subject || "(No subject)"}</td>
                        <td className="px-3 py-3 text-muted">{formatDate(email.receivedAt)}</td>
                      </tr>
                    );
                  })}
                  {!emails.length ? (
                    <tr>
                      <td className="px-3 py-6 text-sm text-muted" colSpan={3}>
                        No emails yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-bg p-4">
            {selectedEmail ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xl font-semibold text-text">{selectedEmail.subject || "(No subject)"}</p>
                  <p className="mt-1 text-sm text-muted">{selectedEmail.sender || "Unknown sender"}</p>
                  <p className="text-sm text-muted">{formatDate(selectedEmail.receivedAt)}</p>
                </div>
                <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border bg-white p-4">
                  <p className="whitespace-pre-wrap text-base leading-8 text-text">
                    {selectedEmail.bodyText?.trim() || "No email body available."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attachmentLabels(selectedEmail.metadata).map((name) => (
                    <span className="rounded-full border border-border bg-white px-2 py-1 text-xs text-text" key={name}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Select an email to preview.</p>
            )}
          </div>
        </div>
      </div>

      {emailDocuments.length ? (
        <div className="rounded-2xl border border-border bg-panel p-4">
          <p className="mb-3 text-sm font-semibold text-text">Upload processing</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border text-sm text-muted">
                <tr>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Processing</th>
                  <th className="px-3 py-2">Uploaded</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {emailDocuments.map((document) => (
                  <tr className="border-b border-border/60 text-sm" key={document.id}>
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium text-text">{document.name}</p>
                        {document.processingError ? (
                          <p className="mt-1 text-xs text-muted">{document.processingError}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <DocumentStatusBadge status={document.parseStatus as DocumentParseStatus} />
                    </td>
                    <td className="px-3 py-3 text-muted">{formatDate(document.createdAt)}</td>
                    <td className="px-3 py-3">
                      {document.parseStatus === "failed" ? <RetryDocumentButton documentId={document.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

