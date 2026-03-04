import { z } from "zod";

export const correspondenceAnalysisSchema = z.object({
  summary: z.string().min(1),
  situationSummary: z.string().min(1),
  commercialRisk: z.string().min(1),
  actionRequired: z.boolean(),
  priority: z.enum(["low", "medium", "high"]),
  recommendedTitle: z.string().min(1),
  recommendedAction: z.string().min(1),
  recommendedPosition: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1).max(6),
  requestedActions: z.array(z.string().min(1)).default([]),
  deadlineSignals: z.array(z.string().min(1)).default([]),
  contractReferences: z.array(z.string().min(1)).default([]),
  draftReply: z.string().min(1),
  draftReplyShort: z.string().min(1),
  draftReplyFirm: z.string().min(1),
  draftReplyCollaborative: z.string().min(1),
  sourceSignals: z.array(z.string()).default([]),
});

export type CorrespondenceAnalysis = z.infer<typeof correspondenceAnalysisSchema>;
