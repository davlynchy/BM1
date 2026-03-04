import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureUserWorkspace } from "@/lib/auth/workspace";
import {
  ALLOWED_DOCUMENT_TYPE_SET,
  AUTHENTICATED_FILE_SIZE_LIMIT,
} from "@/lib/documents/upload-policy";
import {
  createPublicIntakeSession,
  getDefaultCompanyIdForUser,
  getIntakeSessionCookieOptions,
} from "@/lib/intake/session";
import { createClient } from "@/lib/supabase/server";

const createSessionSchema = z.object({
  file: z.object({
    name: z.string().min(1).max(260),
    size: z.number().int().positive(),
    type: z.string().min(1),
    relativePath: z.string().max(1024).nullish(),
  }),
  requiresReattach: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }

    if (!ALLOWED_DOCUMENT_TYPE_SET.has(parsed.data.file.type as never)) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    if (parsed.data.file.size > AUTHENTICATED_FILE_SIZE_LIMIT) {
      return NextResponse.json({ error: "This contract exceeds the 2GB size limit." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let companyId: string | null = null;

    if (user) {
      companyId = (await getDefaultCompanyIdForUser(supabase, user.id)) ?? (await ensureUserWorkspace());
    }

    const session = await createPublicIntakeSession({
      file: parsed.data.file,
      requiresReattach: parsed.data.requiresReattach,
      userId: user?.id ?? null,
      companyId,
    });

    const response = NextResponse.json({
      sessionId: session.id,
      redirectTo: user ? `/app/intake/${session.id}` : `/login?intakeSessionId=${session.id}`,
    });
    response.cookies.set("bidmetric_intake_session", session.id, getIntakeSessionCookieOptions());

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
