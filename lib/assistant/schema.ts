import { z } from "zod";

export const assistantResponseSchema = z.object({
  answer: z.string().min(1),
  citedSourceIds: z.array(z.string()).default([]),
});

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
