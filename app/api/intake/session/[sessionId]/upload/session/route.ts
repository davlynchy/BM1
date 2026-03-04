import { NextResponse } from "next/server";
import { z } from "zod";

import { AUTHENTICATED_FILE_SIZE_LIMIT } from "@/lib/documents/upload-policy";
import { getErrorDetails, getErrorMessage } from "@/lib/errors";
import { getDefaultCompanyIdForUser, getOwnedIntakeSession } from "@/lib/intake/session";
import { createIntakeUploadDescriptor } from "@/lib/intake/upload";
import { createClient } from "@/lib/supabase/server";

const uploadSessionSchema = z.object({
  clientKey: z.string().min(1).max(120),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  let currentUserId: string | null = null;
  let failureStage = "bootstrap";

  try {
    const { sessionId } = await params;
    failureStage = "parse_request";
    const body = await request.json();
    const parsed = uploadSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    }

    currentUserId = user.id;

    failureStage = "resolve_workspace";
    const companyId = await getDefaultCompanyIdForUser(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Finish creating your workspace first." }, { status: 400 });
    }

    failureStage = "load_session";
    const session = await getOwnedIntakeSession({
      sessionId,
      userId: user.id,
    });

    if (!session) {
      return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
    }

    if (new Date(session.expires_at).getTime() < Date.now() || session.status === "expired") {
      return NextResponse.json(
        { error: "Your upload session expired. Please select the contract again." },
        { status: 400 },
      );
    }

    if (!session.project_selection_mode) {
      return NextResponse.json({ error: "Choose where this contract should live." }, { status: 400 });
    }

    if (session.file_size > AUTHENTICATED_FILE_SIZE_LIMIT) {
      return NextResponse.json({ error: "This contract exceeds the 2GB size limit." }, { status: 400 });
    }

    failureStage = "create_descriptor";
    const descriptor = await createIntakeUploadDescriptor({
      session,
      userId: user.id,
      companyId,
      clientKey: parsed.data.clientKey,
    });

    return NextResponse.json(descriptor);
  } catch (error) {
    const message = getErrorMessage(error, "Unable to start upload session.");
    const { sessionId } = await params;
    console.error("Intake upload session failed.", {
      sessionId,
      userId: currentUserId,
      stage: failureStage,
      message,
      details: getErrorDetails(error),
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
