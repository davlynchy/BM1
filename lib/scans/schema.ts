import { z } from "zod";

export const scanCitationSchema = z.object({
  page: z.number().int().min(1),
  section: z.string().min(1),
  snippet: z.string().min(1).max(400),
  chunkIndex: z.number().int().min(0).optional(),
});

export const scanFindingSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(600),
  implication: z.string().min(1).max(600),
  recommendedAction: z.string().min(1).max(600),
  citation: scanCitationSchema,
});

export const contractObligationSchema = z.object({
  category: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  dueRule: z.string().min(1).max(300),
  submissionPath: z.string().min(1).max(300),
  noticePeriodDays: z.number().int().min(0).nullable(),
  citation: scanCitationSchema,
});

export const contractScanExtractionSchema = z.object({
  summary: z.object({
    executiveSummary: z.string().min(1).max(1200),
    topThemes: z.array(z.string().min(1).max(80)).min(1).max(8),
    confidence: z.enum(["low", "medium", "high"]),
  }),
  findings: z.array(scanFindingSchema).min(1).max(12),
  obligations: z.array(contractObligationSchema).min(1).max(20),
});

export type ContractScanExtractionInput = z.infer<typeof contractScanExtractionSchema>;
