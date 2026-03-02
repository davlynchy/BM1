import mammoth from "mammoth";

import type { ParsedDocument } from "@/lib/documents/parsers/types";

function splitByHeadings(text: string) {
  const sections = text
    .split(/\n(?=(?:[A-Z][A-Z0-9 /-]{3,}|[0-9]+(?:\.[0-9]+)*\s+[A-Z]))/g)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.length ? sections : [text];
}

export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.replace(/\r\n/g, "\n").trim();

  if (!text) {
    throw new Error("No readable text found in DOCX document.");
  }

  const sections = splitByHeadings(text);
  const pages = sections.map((content, index) => ({
    pageNumber: index + 1,
    content,
    metadata: {
      sourceType: "docx",
      parser: "mammoth",
      sectionTitle: content.split("\n")[0]?.slice(0, 120) ?? null,
      charCount: content.length,
    },
  }));

  return {
    pages,
    parserVersion: "mammoth@1",
    metadata: {
      warnings: result.messages,
    },
  };
}
