import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ projectId: string; threadId: string }> },
) {
  void request;
  void ctx;
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use GET /api/projects/:projectId/assistant/runs/:runId/stream",
    },
    { status: 410 },
  );
}
