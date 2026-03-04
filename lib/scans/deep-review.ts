import { getOpenAIClient } from "@/lib/ai/client";
import { contractScanExtractionSchema } from "@/lib/scans/schema";
import { buildDeepReviewPrompt } from "@/lib/scans/prompts/deep-review";
import type { ContractScanExtraction } from "@/types/scans";

const DEEP_REVIEW_VERSION = "deep-review-v1";

export async function extractDeepContractReview(context: string): Promise<{
  extraction: ContractScanExtraction;
  promptVersion: string;
}> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You perform deep commercial contract review and return JSON only.",
      },
      {
        role: "user",
        content: buildDeepReviewPrompt(context),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty deep review response.");
  }

  return {
    extraction: contractScanExtractionSchema.parse(JSON.parse(content)),
    promptVersion: DEEP_REVIEW_VERSION,
  };
}
