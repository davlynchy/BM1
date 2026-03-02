import { cookies } from "next/headers";

const PENDING_SCAN_COOKIE = "bidmetric_pending_scan";

export type PendingScan = {
  token: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  bucket: string;
  storagePath: string;
  uploadedAt: string;
};

export function getPendingScanCookieName() {
  return PENDING_SCAN_COOKIE;
}

export function getPendingScanCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  };
}

export async function readPendingScanCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(PENDING_SCAN_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as PendingScan;
  } catch {
    return null;
  }
}

export async function writePendingScanCookie(pendingScan: PendingScan) {
  const cookieStore = await cookies();
  cookieStore.set(
    PENDING_SCAN_COOKIE,
    JSON.stringify(pendingScan),
    getPendingScanCookieOptions(),
  );
}

export async function clearPendingScanCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SCAN_COOKIE);
}

export function getPostAuthRedirectPath(hasPendingScan: boolean) {
  return hasPendingScan ? "/app/intake" : "/app";
}
