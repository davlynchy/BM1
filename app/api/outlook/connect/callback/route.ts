import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { exchangeCodeForTokens, fetchGraphMe } from "@/lib/outlook/oauth";
import { createMutableServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/app?message=${encodeURIComponent(`Outlook connect failed: ${error}`)}`, appUrl));
  }

  const supabase = await createMutableServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?message=Log+in+to+connect+Outlook.", appUrl));
  }

  const cookieStore = await import("next/headers").then((mod) => mod.cookies());
  const expectedState = cookieStore.get("bidmetric_outlook_state")?.value;
  if (!code || !state || !expectedState || expectedState !== state) {
    return NextResponse.redirect(new URL("/app?message=Invalid+Outlook+connect+state.", appUrl));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.default_company_id;

  if (!companyId) {
    return NextResponse.redirect(new URL("/app?message=Choose+a+workspace+before+connecting+Outlook.", appUrl));
  }

  try {
    const tokenPayload = await exchangeCodeForTokens(code);
    const me = await fetchGraphMe(tokenPayload.access_token);
    const expiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
      : null;

    await supabase.from("outlook_accounts").upsert(
      {
        company_id: companyId,
        user_id: user.id,
        status: "connected",
        microsoft_tenant_id: getEnv().MICROSOFT_TENANT_ID || "common",
        microsoft_user_id: me.id ?? null,
        email_address: me.mail ?? me.userPrincipalName ?? user.email ?? null,
        access_token: tokenPayload.access_token,
        refresh_token: tokenPayload.refresh_token ?? null,
        token_expires_at: expiresAt,
        scopes: tokenPayload.scope ? tokenPayload.scope.split(" ") : [],
      },
      { onConflict: "company_id,user_id" },
    );

    const response = NextResponse.redirect(new URL("/app?message=Outlook+connected.", appUrl));
    response.cookies.delete("bidmetric_outlook_state");
    return response;
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "Unable to connect Outlook.";
    return NextResponse.redirect(new URL(`/app?message=${encodeURIComponent(message)}`, appUrl));
  }
}
