import { NextResponse } from "next/server";
import { z } from "zod";

import { getOwnedIntakeSession } from "@/lib/intake/session";
import { completeIntakeUpload } from "@/lib/intake/upload";
import { createClient } from "@/lib/supabase/server";

const completeSchema = z.object({
  documentId: z.string().uuid(),
  uploadId: z.string().min(1),
  parts: z.array(
    z.object({
      partNumber: z.number().int().positive(),
      etag: z.string().min(1),
    }),
  ).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const parsed = completeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload completion payload." }, { status: 400 });
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

    const result = await completeIntakeUpload({
      session,
      documentId: parsed.data.documentId,
      uploadId: parsed.data.uploadId,
      parts: parsed.data.parts,
    });

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finalize upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
