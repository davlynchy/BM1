import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ projectId: string; threadId: string }> },
) {
  void request;
  void ctx;
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use POST /api/projects/:projectId/assistant/messages",
    },
    { status: 410 },
  );
}
