import { getOpenAIClient } from "@/lib/ai/client";
import type { CorrespondenceProjectContext } from "@/lib/correspondence/context";
import { correspondenceAnalysisSchema } from "@/lib/correspondence/schema";

function buildCorrespondencePrompt(params: {
  subject: string;
  sender: string;
  bodyText: string;
  projectContext?: CorrespondenceProjectContext | null;
}) {
  return [
    "You are Bidmetric's commercial correspondence analyst for construction subcontractors.",
    "Review the email and decide whether it creates a commercial action, notice, variation, delay, claim, or contractual follow-up.",
    "Produce commercially credible drafting, not generic customer support language.",
    "Return JSON only.",
    "Always return a practical summary, a commercial position, key points to cover, and three reply variants.",
    "",
    `Subject: ${params.subject}`,
    `Sender: ${params.sender}`,
    "Body:",
    params.bodyText,
    "",
    "Project contract context:",
    params.projectContext
      ? [
          `Executive summary: ${params.projectContext.executiveSummary ?? "Not available."}`,
          `Negotiation points: ${params.projectContext.negotiationPoints.join(" | ") || "None"}`,
          `Top risks: ${params.projectContext.topRisks.join(" | ") || "None"}`,
          `Key obligations: ${params.projectContext.obligations.join(" | ") || "None"}`,
        ].join("\n")
      : "No contract context available.",
  ].join("\n");
}

export async function analyzeCorrespondence(params: {
  subject: string;
  sender: string;
  bodyText: string;
  projectContext?: CorrespondenceProjectContext | null;
}) {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You extract practical commercial action items from construction correspondence as JSON.",
      },
      {
        role: "user",
        content: buildCorrespondencePrompt(params),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty correspondence analysis.");
  }

  return correspondenceAnalysisSchema.parse(JSON.parse(content));
}
