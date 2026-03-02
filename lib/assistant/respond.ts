import { getOpenAIClient } from "@/lib/ai/client";
import { assistantResponseSchema } from "@/lib/assistant/schema";
import type { AssistantCitation } from "@/types/assistant";

type AssistantSource = AssistantCitation & {
  content: string;
};

function buildPrompt(params: {
  question: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  sources: AssistantSource[];
}) {
  const conversation = params.messages
    .slice(-6)
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
    "You are Bidmetric's project assistant for commercial construction subcontractors.",
    "Answer only from the provided project sources.",
    "If the sources do not support the answer, say that clearly and do not infer beyond the evidence.",
    "Keep the answer practical and concise.",
    "Return JSON with keys: answer, citedSourceIds.",
    "",
    "Recent conversation:",
    conversation || "No prior conversation.",
    "",
    "Question:",
    params.question,
    "",
    "Project sources:",
    context,
  ].join("\n");
}

export async function generateAssistantReply(params: {
  question: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  sources: AssistantSource[];
}) {
  if (!params.sources.length) {
    return {
      answer:
        "I could not find support for that in the indexed project documents yet. Upload or index the relevant contract or correspondence first.",
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
        content: "You answer using only supplied construction project sources and return JSON.",
      },
      {
        role: "user",
        content: buildPrompt(params),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty assistant response.");
  }

  const parsed = assistantResponseSchema.parse(JSON.parse(content));
  const citations = params.sources
    .filter((source) => parsed.citedSourceIds.includes(source.sourceId))
    .map((source) => {
      const { content, ...citation } = source;
      void content;
      return citation;
    });

  return {
    answer: parsed.answer,
    citations,
  };
}
