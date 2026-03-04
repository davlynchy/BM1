import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantCitation } from "@/types/assistant";

type ReviewSource = AssistantCitation & {
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

function scoreText(haystack: string, tokens: string[]) {
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function buildSnippet(content: string, tokens: string[]) {
  const lower = content.toLowerCase();
  const matched = tokens.find((token) => lower.includes(token));
  const start = matched ? Math.max(lower.indexOf(matched) - 80, 0) : 0;
  return content.slice(start, Math.min(start + 240, content.length)).replace(/\s+/g, " ").trim();
}

export async function retrieveScanSources(params: {
  companyId: string;
  projectId: string;
  scanId: string;
  documentId: string;
  question: string;
}) {
  const supabase = createAdminClient();
  const queryTokens = tokenize(params.question);

  const [{ data: chunks, error: chunksError }, { data: findings, error: findingsError }, { data: obligations, error: obligationsError }] =
    await Promise.all([
      supabase
        .from("document_chunks")
        .select("id, content, metadata")
        .eq("document_id", params.documentId)
        .limit(300),
      supabase
        .from("contract_scan_findings")
        .select("id, title, summary, implication, recommended_action, citation")
        .eq("scan_id", params.scanId),
      supabase
        .from("contract_obligations")
        .select("id, category, title, due_rule, submission_path, citation")
        .eq("scan_id", params.scanId),
    ]);

  if (chunksError) throw chunksError;
  if (findingsError) throw findingsError;
  if (obligationsError) throw obligationsError;

  const ranked: ReviewSource[] = [];

  for (const chunk of chunks ?? []) {
    const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
    const content = String(chunk.content);
    const haystack = `${content} ${String(metadata.sectionTitle ?? "")}`.toLowerCase();
    const score = scoreText(haystack, queryTokens);

    if (score > 0) {
      ranked.push({
        sourceId: `chunk:${chunk.id}`,
        documentId: params.documentId,
        documentName: "Contract",
        pageNumber:
          typeof metadata.pageNumber === "number"
            ? metadata.pageNumber
            : typeof metadata.page_number === "number"
              ? metadata.page_number
              : null,
        sectionTitle: typeof metadata.sectionTitle === "string" ? metadata.sectionTitle : undefined,
        snippet: buildSnippet(content, queryTokens),
        content,
        score,
      });
    }
  }

  for (const finding of findings ?? []) {
    const content = [
      String(finding.title ?? ""),
      String(finding.summary ?? ""),
      String(finding.implication ?? ""),
      String(finding.recommended_action ?? ""),
    ].join(" ");
    const citation = (finding.citation ?? {}) as Record<string, unknown>;
    ranked.push({
      sourceId: `finding:${finding.id}`,
      documentId: params.documentId,
      documentName: "Contract review finding",
      pageNumber: typeof citation.page === "number" ? citation.page : null,
      sectionTitle: typeof citation.section === "string" ? citation.section : "Finding",
      snippet: typeof citation.snippet === "string" ? citation.snippet : buildSnippet(content, queryTokens),
      content,
      score: 3 + scoreText(content.toLowerCase(), queryTokens),
    });
  }

  for (const obligation of obligations ?? []) {
    const content = [
      String(obligation.category ?? ""),
      String(obligation.title ?? ""),
      String(obligation.due_rule ?? ""),
      String(obligation.submission_path ?? ""),
    ].join(" ");
    const citation = (obligation.citation ?? {}) as Record<string, unknown>;
    ranked.push({
      sourceId: `obligation:${obligation.id}`,
      documentId: params.documentId,
      documentName: "Contract obligation",
      pageNumber: typeof citation.page === "number" ? citation.page : null,
      sectionTitle: typeof citation.section === "string" ? citation.section : "Obligation",
      snippet: typeof citation.snippet === "string" ? citation.snippet : buildSnippet(content, queryTokens),
      content,
      score: 3 + scoreText(content.toLowerCase(), queryTokens),
    });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, 8);
}
