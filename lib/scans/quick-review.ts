import { z } from "zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { scanFindingSchema } from "@/lib/scans/schema";
import { buildQuickReviewPrompt } from "@/lib/scans/prompts/quick-review";
import type { QuickReviewResult } from "@/types/scans";

const QUICK_REVIEW_VERSION = "quick-review-v1";

const quickReviewSchema = z.object({
  summary: z.object({
    executiveSummary: z.string().min(1).max(1200),
    topThemes: z.array(z.string().min(1).max(80)).min(1).max(8),
    confidence: z.enum(["low", "medium", "high"]),
    negotiationPoints: z.array(z.string().min(1).max(300)).min(1).max(8),
    priorityActions: z.array(z.string().min(1).max(300)).min(1).max(8),
  }),
  findings: z.array(scanFindingSchema).min(3).max(6),
});

export async function extractQuickContractReview(context: string): Promise<{
  review: QuickReviewResult;
  promptVersion: string;
}> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You perform quick commercial contract triage and return JSON only.",
      },
      {
        role: "user",
        content: buildQuickReviewPrompt(context),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty quick review response.");
  }

  const parsed = quickReviewSchema.parse(JSON.parse(content));
  return {
    review: parsed,
    promptVersion: QUICK_REVIEW_VERSION,
  };
}
