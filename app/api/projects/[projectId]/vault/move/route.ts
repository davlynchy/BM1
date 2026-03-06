import { NextResponse } from "next/server";
import { z } from "zod";

import { requireProjectAccess } from "@/lib/projects/access";

const bodySchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1),
  folderName: z.string().trim().min(1).max(180),
});

function sanitizeFolderName(value: string) {
  return value
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid move payload." }, { status: 400 });
    }

    const { supabase, project } = await requireProjectAccess(projectId);
    const folderName = sanitizeFolderName(parsed.data.folderName);
    if (!folderName) {
      return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
    }

    const { data: documents, error: loadError } = await supabase
      .from("documents")
      .select("id, name")
      .eq("project_id", project.id)
      .in("id", parsed.data.documentIds);

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 400 });
    }

    for (const document of documents ?? []) {
      const relativePath = `${folderName}/${String(document.name)}`;
      const { error } = await supabase
        .from("documents")
        .update({ relative_path: relativePath })
        .eq("id", document.id)
        .eq("project_id", project.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to move files.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

