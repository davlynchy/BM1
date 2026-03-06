import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { getOutlookAuthUrl } from "@/lib/outlook/oauth";
import { createMutableServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createMutableServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL;

  if (!user) {
    return NextResponse.redirect(new URL("/login?message=Log+in+to+connect+Outlook.", appUrl));
  }

  const state = randomUUID();
  const authUrl = getOutlookAuthUrl({ state });

  if (!authUrl) {
    return NextResponse.json({ error: "Outlook integration is not configured." }, { status: 400 });
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("bidmetric_outlook_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
