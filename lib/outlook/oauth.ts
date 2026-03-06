import { getEnv } from "@/lib/env";

function getTenantId() {
  return getEnv().MICROSOFT_TENANT_ID || "common";
}

export function getOutlookAuthUrl(params: { state: string }) {
  const env = getEnv();
  if (!env.MICROSOFT_CLIENT_ID) {
    return null;
  }

  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/outlook/connect/callback`;
  const scopes =
    env.MICROSOFT_GRAPH_SCOPES ||
    "offline_access openid profile email User.Read Mail.Read";

  const authUrl = new URL(`https://login.microsoftonline.com/${getTenantId()}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", env.MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", params.state);

  return authUrl.toString();
}

export async function exchangeCodeForTokens(code: string) {
  const env = getEnv();
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new Error("Outlook integration is not configured.");
  }

  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/outlook/connect/callback`;
  const body = new URLSearchParams();
  body.set("client_id", env.MICROSOFT_CLIENT_ID);
  body.set("client_secret", env.MICROSOFT_CLIENT_SECRET);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set(
    "scope",
    env.MICROSOFT_GRAPH_SCOPES || "offline_access openid profile email User.Read Mail.Read",
  );

  const response = await fetch(
    `https://login.microsoftonline.com/${getTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error("Unable to exchange Outlook authorization code.");
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function fetchGraphMe(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to load Microsoft profile.");
  }

  return (await response.json()) as {
    id?: string;
    userPrincipalName?: string;
    mail?: string;
  };
}
