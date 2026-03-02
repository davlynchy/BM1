type ScanContextChunk = {
  id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
};

const CATEGORY_QUERIES = [
  "payment claim progress claim invoice certificate due payment payapps",
  "variation variations change direction written notice latent condition",
  "extension of time eot delay notice time bar programming",
  "liquidated damages delay damages ld completion date",
  "indemnity indemnities liability consequential loss",
  "termination suspension breach default",
  "security retention bank guarantee",
];

function scoreChunk(content: string, query: string) {
  const lowerContent = content.toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, term) => score + (lowerContent.includes(term) ? 1 : 0), 0);
}

export function buildContractScanContext(chunks: ScanContextChunk[]) {
  const byScore = chunks
    .map((chunk) => ({
      chunk,
      score: CATEGORY_QUERIES.reduce(
        (total, query) => total + scoreChunk(chunk.content, query),
        0,
      ),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.chunk.chunk_index - b.chunk.chunk_index;
    });

  const selected = new Map<string, ScanContextChunk>();

  chunks
    .slice(0, 10)
    .forEach((chunk) => selected.set(chunk.id, chunk));

  byScore.slice(0, 40).forEach(({ chunk }) => selected.set(chunk.id, chunk));

  const context = Array.from(selected.values())
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map((chunk) => {
      const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
      const section = typeof metadata.sectionTitle === "string" ? metadata.sectionTitle : "Clause";
      const pageNumber =
        typeof metadata.pageNumber === "number"
          ? metadata.pageNumber
          : typeof metadata.page_number === "number"
            ? metadata.page_number
            : null;

      return [
        `[CHUNK ${chunk.chunk_index}]`,
        pageNumber ? `Page: ${pageNumber}` : "Page: unknown",
        `Section: ${section}`,
        chunk.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return context.slice(0, 60000);
}
