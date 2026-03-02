import { simpleParser } from "mailparser";

import type { ParsedDocument } from "@/lib/documents/parsers/types";

export async function parseEml(buffer: Buffer): Promise<ParsedDocument> {
  const message = (await simpleParser(buffer)) as {
    subject?: string;
    from?: { text?: string };
    to?: { text?: string };
    cc?: { text?: string };
    date?: Date;
    text?: string;
    html?: string;
    attachments: Array<{
      filename?: string;
      contentType?: string;
      size?: number;
    }>;
  };
  const headerLines = [
    `Subject: ${message.subject ?? ""}`,
    `From: ${message.from?.text ?? ""}`,
    `To: ${message.to?.text ?? ""}`,
    `Cc: ${message.cc?.text ?? ""}`,
    `Date: ${message.date?.toISOString() ?? ""}`,
  ].join("\n");
  const bodyText = (message.text ?? message.html ?? "").toString().trim();

  if (!bodyText) {
    throw new Error("No readable body content found in email.");
  }

  const pages = [
    {
      pageNumber: 1,
      content: headerLines,
      metadata: {
        sourceType: "eml",
        parser: "mailparser",
        sectionTitle: "Email Header",
      },
    },
    ...bodyText
      .split(/\n\s*\n/g)
      .map((section: string) => section.trim())
      .filter(Boolean)
      .map((content: string, index: number) => ({
        pageNumber: index + 2,
        content,
        metadata: {
          sourceType: "eml",
          parser: "mailparser",
          sectionTitle: index === 0 ? "Email Body" : `Email Body ${index + 1}`,
          charCount: content.length,
        },
      })),
  ];

  return {
    pages,
    parserVersion: "mailparser@1",
    metadata: {
      correspondence: {
        subject: message.subject ?? "",
        sender: message.from?.text ?? "",
        to: message.to?.text ?? "",
        cc: message.cc?.text ?? "",
        receivedAt: message.date?.toISOString() ?? null,
        bodyText,
        attachments: message.attachments.map((attachment) => ({
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
        })),
      },
      attachments: message.attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
      })),
    },
  };
}
