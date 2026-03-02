import { NextResponse } from "next/server";

import { ensureUserWorkspace } from "@/lib/auth/workspace";
import { readPendingScanCookie } from "@/lib/intake/pending-scan";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

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

  await ensureUserWorkspace();
  const pendingScan = await readPendingScanCookie();

  return NextResponse.redirect(new URL(pendingScan ? "/app/intake" : "/app", request.url));
}
