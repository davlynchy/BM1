import { NextResponse } from "next/server";

import { ensureUserWorkspace } from "@/lib/auth/workspace";
import {
  attachIntakeSessionToWorkspace,
  readIntakeSessionCookie,
} from "@/lib/intake/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const intakeSessionId = requestUrl.searchParams.get("intakeSessionId");

  if (!code) {
    return NextResponse.redirect(new URL("/login?message=Missing+auth+code.", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const companyId = await ensureUserWorkspace();
  const resolvedSessionId = intakeSessionId ?? (await readIntakeSessionCookie());

  if (resolvedSessionId && user) {
    await attachIntakeSessionToWorkspace({
      sessionId: resolvedSessionId,
      userId: user.id,
      companyId,
    });

    return NextResponse.redirect(new URL(`/app/intake/${resolvedSessionId}`, request.url));
  }

  return NextResponse.redirect(new URL("/app", request.url));
}
