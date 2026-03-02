import pdfParse from "pdf-parse";

import type { ParsedDocument } from "@/lib/documents/parsers/types";

export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const parsed = (await pdfParse(buffer)) as {
    text: string;
    info?: Record<string, unknown>;
  };
  const text = parsed.text.replace(/\r\n/g, "\n").trim();

  if (!text || text.length < 50) {
    throw new Error("Scanned or image-only PDFs are not supported in this stage.");
  }

  const rawPages = text
    .split(/\n\s*\n(?=[A-Z0-9][^\n]{0,120}$)/gm)
    .map((segment: string) => segment.trim())
    .filter(Boolean);

  const pages = (rawPages.length ? rawPages : [text]).map((content: string, index: number) => ({
    pageNumber: index + 1,
    content,
    metadata: {
      sourceType: "pdf",
      parser: "pdf-parse",
      charCount: content.length,
    },
  }));

  return {
    pages,
    parserVersion: "pdf-parse@1",
    metadata: {
      info: parsed.info ?? null,
      pageCount: pages.length,
    },
  };
}
