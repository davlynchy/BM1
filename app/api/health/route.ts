import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

export async function GET() {
  const env = getEnv();

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
      openai: Boolean(env.OPENAI_API_KEY),
      stripe: Boolean(env.STRIPE_SECRET_KEY),
    },
  });
}
