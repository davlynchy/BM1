import { NextResponse } from "next/server";

import { createMutableServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createMutableServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.default_company_id) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 400 });
  }

  const { error } = await supabase
    .from("outlook_accounts")
    .update({
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    })
    .eq("company_id", profile.default_company_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
