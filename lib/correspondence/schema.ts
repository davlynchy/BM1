import { z } from "zod";

export const correspondenceAnalysisSchema = z.object({
  summary: z.string().min(1),
  actionRequired: z.boolean(),
  priority: z.enum(["low", "medium", "high"]),
  recommendedTitle: z.string().min(1),
  recommendedAction: z.string().min(1),
  draftReply: z.string().min(1),
  sourceSignals: z.array(z.string()).default([]),
});

export type CorrespondenceAnalysis = z.infer<typeof correspondenceAnalysisSchema>;
