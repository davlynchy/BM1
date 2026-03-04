import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getDefaultCompanyIdForUser,
  selectIntakeProject,
} from "@/lib/intake/session";
import { createClient } from "@/lib/supabase/server";

const assignProjectSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create_new"),
    projectName: z.string().min(2).max(160),
  }),
  z.object({
    mode: z.literal("existing"),
    projectId: z.string().uuid(),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const parsed = assignProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Select where this contract should live." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    }

    const companyId = await getDefaultCompanyIdForUser(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Finish creating your workspace first." }, { status: 400 });
    }

    if (parsed.data.mode === "existing") {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", parsed.data.projectId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (projectError || !project) {
        return NextResponse.json({ error: "Choose a valid project." }, { status: 400 });
      }
    }

    await selectIntakeProject({
      sessionId,
      userId: user.id,
      mode: parsed.data.mode,
      projectId: parsed.data.mode === "existing" ? parsed.data.projectId : null,
      newProjectName: parsed.data.mode === "create_new" ? parsed.data.projectName : null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save project selection.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
