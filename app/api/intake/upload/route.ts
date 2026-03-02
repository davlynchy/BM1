import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  getPendingScanCookieName,
  getPendingScanCookieOptions,
} from "@/lib/intake/pending-scan";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822",
]);

async function ensureContractsBucket() {
  const supabase = createAdminClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    throw error;
  }

  const exists = buckets.some((bucket) => bucket.name === "contracts");

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket("contracts", {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Array.from(ALLOWED_TYPES),
    });

    if (createError) {
      throw createError;
    }
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 30MB limit for the free intake flow." }, { status: 400 });
    }

    await ensureContractsBucket();

    const token = randomUUID();
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const storagePath = `intake/${token}/original.${extension}`;
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const pendingScan = {
      token,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      bucket: "contracts",
      storagePath,
      uploadedAt: new Date().toISOString(),
    };

    const response = NextResponse.json({
      success: true,
      redirectTo: "/signup?next=%2Fapp%2Fintake",
    });
    response.cookies.set(
      getPendingScanCookieName(),
      JSON.stringify(pendingScan),
      getPendingScanCookieOptions(),
    );

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
