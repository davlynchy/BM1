import type { ExtractedChunk, ExtractedPage } from "@/types/ingestion";

const TARGET_CHUNK_SIZE = 700;
const OVERLAP_SIZE = 120;

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

function normalizeText(text: string) {
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitStructurally(content: string) {
  const parts = content
    .split(/\n(?=(?:[0-9]+(?:\.[0-9]+)*\s+|[A-Z][A-Z0-9 /()-]{4,}$))/g)
    .map((part) => normalizeText(part))
    .filter(Boolean);

  return parts.length > 1 ? parts : [normalizeText(content)];
}

function splitBySize(content: string) {
  const words = content.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const word of words) {
    const nextTokens = estimateTokenCount(word);

    if (currentTokens + nextTokens > TARGET_CHUNK_SIZE && current.length) {
      chunks.push(current.join(" "));
      const overlapWords = current.slice(Math.max(current.length - OVERLAP_SIZE / 4, 0));
      current = [...overlapWords, word];
      currentTokens = estimateTokenCount(current.join(" "));
      continue;
    }

    current.push(word);
    currentTokens += nextTokens;
  }

  if (current.length) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

export function createDocumentChunks(params: {
  pages: ExtractedPage[];
  documentType: string;
}) {
  const chunks: ExtractedChunk[] = [];
  let chunkIndex = 0;

  for (const page of params.pages) {
    const structuralParts = splitStructurally(page.content);

    for (const part of structuralParts) {
      const chunkParts =
        estimateTokenCount(part) > TARGET_CHUNK_SIZE ? splitBySize(part) : [part];

      for (const chunkContent of chunkParts) {
        const cleanContent = normalizeText(chunkContent);

        if (!cleanContent) {
          continue;
        }

        chunks.push({
          chunkIndex,
          content: cleanContent,
          tokenCount: estimateTokenCount(cleanContent),
          pageNumber: page.pageNumber,
          metadata: {
            pageNumber: page.pageNumber,
            sourceKind: String(page.metadata.sourceType ?? "document"),
            documentType: params.documentType,
            sectionTitle:
              typeof page.metadata.sectionTitle === "string"
                ? page.metadata.sectionTitle
                : undefined,
            sheetName:
              typeof page.metadata.sheetName === "string"
                ? page.metadata.sheetName
                : undefined,
          },
        });
        chunkIndex += 1;
      }
    }
  }

  return chunks;
}
