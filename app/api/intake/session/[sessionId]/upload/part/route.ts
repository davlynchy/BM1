import { NextResponse } from "next/server";
import { z } from "zod";

import { getOwnedIntakeSession } from "@/lib/intake/session";
import { createIntakePartUrls } from "@/lib/intake/upload";
import { createClient } from "@/lib/supabase/server";

const partRequestSchema = z.object({
  documentId: z.string().uuid(),
  uploadId: z.string().min(1),
  partNumbers: z.array(z.number().int().positive()).min(1).max(250),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const parsed = partRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    }

    const session = await getOwnedIntakeSession({
      sessionId,
      userId: user.id,
    });

    if (!session) {
      return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
    }

    const parts = await createIntakePartUrls({
      session,
      documentId: parsed.data.documentId,
      uploadId: parsed.data.uploadId,
      partNumbers: parsed.data.partNumbers,
    });

    return NextResponse.json({ parts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign multipart upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
