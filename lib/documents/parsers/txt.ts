import type { ParsedDocument } from "@/lib/documents/parsers/types";

export async function parseTxt(buffer: Buffer): Promise<ParsedDocument> {
  const text = buffer.toString("utf8").replace(/\r\n/g, "\n").trim();

  if (!text) {
    throw new Error("No readable text found in TXT document.");
  }

  const sections = text
    .split(/\n\s*\n/g)
    .map((section) => section.trim())
    .filter(Boolean);

  const pages = (sections.length ? sections : [text]).map((content, index) => ({
    pageNumber: index + 1,
    content,
    metadata: {
      sourceType: "txt",
      parser: "text",
      charCount: content.length,
    },
  }));

  return {
    pages,
    parserVersion: "text@1",
  };
}
