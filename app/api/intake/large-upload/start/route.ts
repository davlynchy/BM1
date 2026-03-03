import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ALLOWED_DOCUMENT_TYPE_SET,
  ANONYMOUS_UPLOAD_THRESHOLD,
  MAX_BATCH_FILE_COUNT,
} from "@/lib/documents/upload-policy";

const intakeStartSchema = z.object({
  files: z.array(
    z.object({
      name: z.string().min(1).max(260),
      size: z.number().int().positive(),
      type: z.string().min(1),
      relativePath: z.string().max(1024).nullish(),
    }),
  ).min(1).max(MAX_BATCH_FILE_COUNT),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = intakeStartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }

    for (const file of parsed.data.files) {
      if (!ALLOWED_DOCUMENT_TYPE_SET.has(file.type as never)) {
        return NextResponse.json({ error: `Unsupported file type for ${file.name}.` }, { status: 400 });
      }
    }

    const requiresAuth =
      parsed.data.files.length > 1 ||
      parsed.data.files.some((file) => file.size > ANONYMOUS_UPLOAD_THRESHOLD || Boolean(file.relativePath));

    return NextResponse.json({
      mode: requiresAuth ? "requires_auth" : "anonymous",
      redirectTo: requiresAuth ? "/signup?next=%2Fupload&message=Create+an+account+to+upload+large+files+or+folders." : null,
      anonymousThreshold: ANONYMOUS_UPLOAD_THRESHOLD,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to evaluate upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
