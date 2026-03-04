import { NextResponse } from "next/server";
import { z } from "zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { getProjectOutput, updateProjectOutput } from "@/lib/outputs/store";
import { requireProjectAccess } from "@/lib/projects/access";

const rewriteSchema = z.object({
  instruction: z.string().trim().min(1).max(240),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; outputId: string }> },
) {
  try {
    const { projectId, outputId } = await params;
    await requireProjectAccess(projectId);
    const parsed = rewriteSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid rewrite instruction." }, { status: 400 });
    }

    const output = await getProjectOutput(outputId, projectId);

    if (!output) {
      return NextResponse.json({ error: "Output not found." }, { status: 404 });
    }

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Rewrite the work product while preserving substance and citations where possible. Return plain text only.",
        },
        {
          role: "user",
          content: `Instruction: ${parsed.data.instruction}\n\nCurrent title: ${output.title}\n\nCurrent body:\n${output.body}`,
        },
      ],
    });

    const body = response.choices[0]?.message?.content?.trim();

    if (!body) {
      return NextResponse.json({ error: "Rewrite returned empty output." }, { status: 400 });
    }

    const updated = await updateProjectOutput({
      outputId,
      title: output.title,
      body,
      status: output.status,
      metadata: {
        ...output.metadata,
        lastRewriteInstruction: parsed.data.instruction,
      },
    });

    return NextResponse.json({ output: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rewrite output.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
