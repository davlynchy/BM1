import { getOpenAIClient } from "@/lib/ai/client";

export async function embedTexts(texts: string[]) {
  if (!texts.length) {
    return [];
  }

  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}
