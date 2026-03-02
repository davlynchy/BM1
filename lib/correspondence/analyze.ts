import { getOpenAIClient } from "@/lib/ai/client";
import { correspondenceAnalysisSchema } from "@/lib/correspondence/schema";

function buildCorrespondencePrompt(params: {
  subject: string;
  sender: string;
  bodyText: string;
}) {
  return [
    "You are Bidmetric's commercial correspondence analyst for construction subcontractors.",
    "Review the email and decide whether it creates a commercial action, notice, variation, delay, claim, or contractual follow-up.",
    "Return JSON only.",
    "If no action is required, still return a short summary and a polite holding reply draft.",
    "",
    `Subject: ${params.subject}`,
    `Sender: ${params.sender}`,
    "Body:",
    params.bodyText,
  ].join("\n");
}

export async function analyzeCorrespondence(params: {
  subject: string;
  sender: string;
  bodyText: string;
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
