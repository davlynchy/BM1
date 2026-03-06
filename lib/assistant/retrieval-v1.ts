import { embedTexts } from "@/lib/ai/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantCitation } from "@/types/assistant";

type RetrievedSource = AssistantCitation & {
  content: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function buildSnippet(content: string, tokens: string[]) {
  const lower = content.toLowerCase();
  const matched = tokens.find((token) => lower.includes(token));
  const rawStart = matched ? Math.max(lower.indexOf(matched) - 180, 0) : 0;
  const previousBoundary = Math.max(
    content.lastIndexOf("\n", rawStart),
    content.lastIndexOf(". ", rawStart),
  );
  const start = previousBoundary > -1 ? previousBoundary + 1 : rawStart;
  const end = Math.min(content.length, start + 420);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

function lexicalBoost(content: string, sectionTitle: string | undefined, queryTokens: string[]) {
  const haystack = `${sectionTitle ?? ""}\n${content}`.toLowerCase();
  return queryTokens.reduce((acc, token) => {
    if (!haystack.includes(token)) {
      return acc;
    }

    let score = 1;
    if (sectionTitle?.toLowerCase().includes(token)) {
      score += 1.5;
    }
    if (content.toLowerCase().includes(token)) {
      score += 1.5;
    }
    return acc + score;
  }, 0);
}

export async function retrieveProjectSourcesV1(params: {
  companyId: string;
  projectId: string;
  question: string;
  documentIds?: string[];
  limit?: number;
}) {
  const supabase = createAdminClient();
  const limit = Math.max(4, Math.min(params.limit ?? 8, 20));
  const queryTokens = tokenize(params.question);
  const [queryEmbedding] = await embedTexts([params.question]);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    p_company_id: params.companyId,
    p_project_id: params.projectId,
    p_query_embedding: queryEmbedding,
    p_limit: 50,
    p_document_ids: params.documentIds?.length ? params.documentIds : null,
  });

  if (error) {
    throw error;
  }

  const ranked = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const content = String(row.content ?? "");
      const sectionTitle =
        typeof metadata.sectionTitle === "string"
          ? metadata.sectionTitle
          : typeof metadata.section_title === "string"
            ? metadata.section_title
            : undefined;
      const vectorScore = Number(row.similarity ?? 0);
      const keywordScore = lexicalBoost(content, sectionTitle, queryTokens);
      const combinedScore = vectorScore * 100 + keywordScore;

      return {
        chunkId: String(row.chunk_id),
        sourceId: String(row.chunk_id),
        documentId: String(row.document_id),
        documentName: String(row.document_name ?? "Project document"),
        page:
          typeof metadata.pageNumber === "number"
            ? metadata.pageNumber
            : typeof metadata.page_number === "number"
              ? metadata.page_number
              : null,
        pageNumber:
          typeof metadata.pageNumber === "number"
            ? metadata.pageNumber
            : typeof metadata.page_number === "number"
              ? metadata.page_number
              : null,
        snippet: buildSnippet(content, queryTokens),
        sectionTitle,
        score: Number(combinedScore.toFixed(3)),
        content,
      } satisfies RetrievedSource;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked;
}
