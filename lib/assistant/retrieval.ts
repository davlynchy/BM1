import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantCitation } from "@/types/assistant";

type RetrievedSource = AssistantCitation & {
  content: string;
  score: number;
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
  if (!content) {
    return "";
  }

  const lower = content.toLowerCase();
  const matched = tokens.find((token) => lower.includes(token));
  const start = matched ? Math.max(lower.indexOf(matched) - 80, 0) : 0;
  const end = Math.min(start + 240, content.length);

  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

function scoreChunk(params: { queryTokens: string[]; content: string; sectionTitle?: string; documentName: string }) {
  const haystack = `${params.documentName} ${params.sectionTitle ?? ""} ${params.content}`.toLowerCase();

  return params.queryTokens.reduce((score, token) => {
    if (!haystack.includes(token)) {
      return score;
    }

    const contentWeight = params.content.toLowerCase().includes(token) ? 3 : 0;
    const headingWeight = params.sectionTitle?.toLowerCase().includes(token) ? 2 : 0;

    return score + 1 + contentWeight + headingWeight;
  }, 0);
}

export async function retrieveProjectSources(params: {
  companyId: string;
  projectId: string;
  question: string;
  documentIds?: string[];
}) {
  const supabase = createAdminClient();
  let documentsQuery = supabase
    .from("documents")
    .select("id, name")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("parse_status", "indexed");

  if (params.documentIds?.length) {
    documentsQuery = documentsQuery.in("id", params.documentIds);
  }

  const { data: documents, error: documentsError } = await documentsQuery;

  if (documentsError) {
    throw documentsError;
  }

  if (!documents?.length) {
    return [] as RetrievedSource[];
  }

  const documentNameById = new Map(documents.map((document) => [String(document.id), String(document.name)]));
  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("id, document_id, chunk_index, content, metadata")
    .in(
      "document_id",
      documents.map((document) => document.id),
    )
    .limit(800);

  if (chunksError) {
    throw chunksError;
  }

  const queryTokens = tokenize(params.question);
  const ranked = (chunks ?? [])
    .map((chunk) => {
      const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
      const content = String(chunk.content);
      const documentId = String(chunk.document_id);
      const documentName = documentNameById.get(documentId) ?? "Project document";
      const score = scoreChunk({
        queryTokens,
        content,
        sectionTitle: typeof metadata.sectionTitle === "string" ? metadata.sectionTitle : undefined,
        documentName,
      });

      return {
        sourceId: String(chunk.id),
        documentId,
        documentName,
        pageNumber:
          typeof metadata.pageNumber === "number"
            ? metadata.pageNumber
            : typeof metadata.pageNumber === "string"
              ? Number(metadata.pageNumber)
              : null,
        snippet: buildSnippet(content, queryTokens),
        sectionTitle: typeof metadata.sectionTitle === "string" ? metadata.sectionTitle : undefined,
        content,
        score,
      } satisfies RetrievedSource;
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  return ranked;
}
