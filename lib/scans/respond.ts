import { getOpenAIClient } from "@/lib/ai/client";
import { assistantResponseSchema } from "@/lib/assistant/schema";
import type { AssistantCitation, AssistantMessageRecord } from "@/types/assistant";

type ReviewSource = AssistantCitation & {
  content: string;
};

function buildPrompt(params: {
  question: string;
  messages: AssistantMessageRecord[];
  sources: ReviewSource[];
}) {
  const conversation = params.messages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");

  const context = params.sources
    .map(
      (source, index) =>
        [
          `Source ${index + 1} (${source.sourceId})`,
          `Document: ${source.documentName}`,
          `Page: ${source.pageNumber ?? "Unknown"}`,
          `Section: ${source.sectionTitle ?? "Unknown"}`,
          `Snippet: ${source.snippet}`,
          `Content: ${source.content}`,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    "You are Bidmetric's contract review assistant for construction subcontractors.",
    "Answer like a sharp commercial reviewer, not a generic legal bot.",
    "Be practical, direct, and grounded in the supplied evidence only.",
    "If evidence is incomplete, say so clearly.",
    "Return JSON with keys: answer, citedSourceIds.",
    "",
    "Recent conversation:",
    conversation || "No prior conversation.",
    "",
    "Question:",
    params.question,
    "",
    "Review evidence:",
    context,
  ].join("\n");
}

export async function answerContractReviewQuestion(params: {
  question: string;
  messages: AssistantMessageRecord[];
  sources: ReviewSource[];
}) {
  if (!params.sources.length) {
    return {
      answer:
        "I do not have enough grounded contract evidence for that yet. Let the review finish or ask about a clause that has already been extracted.",
      citations: [] as AssistantCitation[],
    };
  }

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You answer grounded contract review questions and return JSON only.",
      },
      {
        role: "user",
        content: buildPrompt(params),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty contract review response.");
  }

  const parsed = assistantResponseSchema.parse(JSON.parse(content));
  const citations = params.sources
    .filter((source) => parsed.citedSourceIds.includes(source.sourceId))
    .map((source) => {
      const citation = {
        sourceId: source.sourceId,
        documentId: source.documentId,
        documentName: source.documentName,
        pageNumber: source.pageNumber,
        snippet: source.snippet,
        sectionTitle: source.sectionTitle,
      };
      return citation;
    });

  return {
    answer: parsed.answer,
    citations,
  };
}
