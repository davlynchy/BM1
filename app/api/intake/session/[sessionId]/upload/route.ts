import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return NextResponse.json(
    {
      error: "This intake upload route is outdated. Refresh the page and try again.",
      sessionId,
    },
    { status: 410 },
  );
}
