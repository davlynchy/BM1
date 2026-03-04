import { NextResponse } from "next/server";
import { z } from "zod";

import { getProjectOutput, listProjectOutputVersions, updateProjectOutput } from "@/lib/outputs/store";
import { requireProjectAccess } from "@/lib/projects/access";

const updateOutputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; outputId: string }> },
) {
  try {
    const { projectId, outputId } = await params;
    await requireProjectAccess(projectId);
    const output = await getProjectOutput(outputId, projectId);

    if (!output) {
      return NextResponse.json({ error: "Output not found." }, { status: 404 });
    }

    const versions = await listProjectOutputVersions(outputId);

    return NextResponse.json({ output, versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load output.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; outputId: string }> },
) {
  try {
    const { projectId, outputId } = await params;
    await requireProjectAccess(projectId);
    const parsed = updateOutputSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid output update." }, { status: 400 });
    }

    const output = await updateProjectOutput({
      outputId,
      title: parsed.data.title,
      body: parsed.data.body,
      status: parsed.data.status,
    });

    return NextResponse.json({ output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update output.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
