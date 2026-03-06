import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
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
    return NextResponse.json({ emails: [] });
  }

  const { data: emails, error } = await supabase
    .from("project_correspondence")
    .select("id, sender, subject, received_at, routing_confidence, routing_reasons")
    .eq("company_id", profile.default_company_id)
    .is("project_id", null)
    .order("received_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ emails: emails ?? [] });
}
