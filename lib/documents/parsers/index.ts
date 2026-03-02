import type { ParsedDocument } from "@/lib/documents/parsers/types";
import { parseDocx } from "@/lib/documents/parsers/docx";
import { parseEml } from "@/lib/documents/parsers/eml";
import { parsePdf } from "@/lib/documents/parsers/pdf";
import { parseTxt } from "@/lib/documents/parsers/txt";
import { parseXlsx } from "@/lib/documents/parsers/xlsx";

export async function parseDocumentByMimeType(params: {
  mimeType: string | null;
  buffer: Buffer;
}): Promise<ParsedDocument> {
  switch (params.mimeType) {
    case "application/pdf":
      return parsePdf(params.buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(params.buffer);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return parseXlsx(params.buffer);
    case "text/plain":
      return parseTxt(params.buffer);
    case "message/rfc822":
      return parseEml(params.buffer);
    default:
      throw new Error(`Unsupported MIME type: ${params.mimeType ?? "unknown"}`);
  }
}
