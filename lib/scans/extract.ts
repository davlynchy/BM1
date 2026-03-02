import { getOpenAIClient } from "@/lib/ai/client";
import { contractScanExtractionSchema } from "@/lib/scans/schema";
import type { ContractScanExtraction } from "@/types/scans";

const PROMPT_VERSION = "stage5-v1";

function buildScanPrompt(context: string) {
  return [
    "You are Bidmetric, a commercial contract analysis assistant for construction subcontractors.",
    "Extract structured commercial obligations and risk findings from the contract context below.",
    "Return valid JSON only.",
    "Rules:",
    "- Focus on commercial construction subcontract risk, not generic legal commentary.",
    "- Every finding and obligation must include a citation from the provided context.",
    "- Use the exact page number and a short source snippet.",
    "- Do not invent clauses or obligations that are not grounded in the text.",
    "- Prefer practical commercial implications and actions.",
    "- If evidence is weak, lower confidence rather than hallucinating.",
    "",
    "Required risk categories to consider:",
    "- payment claims",
    "- variations",
    "- extension of time / time bars",
    "- liquidated damages",
    "- indemnities / liability",
    "- suspension / termination",
    "- set-off / withholding",
    "- security / retention",
    "",
    "Return JSON matching this shape:",
    "{ summary: { executiveSummary, topThemes[], confidence }, findings: [], obligations: [] }",
    "",
    "Contract context:",
    context,
  ].join("\n");
}

export async function extractContractScan(context: string): Promise<{
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
        content: "You extract structured commercial contract data as JSON.",
      },
      {
        role: "user",
        content: buildScanPrompt(context),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty contract scan response.");
  }

  const parsedJson = JSON.parse(content);
  const extraction = contractScanExtractionSchema.parse(parsedJson);

  return {
    extraction,
    promptVersion: PROMPT_VERSION,
  };
}
