import type { ExtractedPage } from "@/types/ingestion";

export type ParsedDocument = {
  pages: ExtractedPage[];
  parserVersion: string;
  metadata?: Record<string, unknown>;
};
