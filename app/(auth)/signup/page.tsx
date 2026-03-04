import { signUpAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicIntakeSessionSummary } from "@/lib/intake/session";

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string; intakeSessionId?: string }>;
}) {
  const { message, next, intakeSessionId } = await searchParams;
  const intakeSession = intakeSessionId ? await getPublicIntakeSessionSummary(intakeSessionId) : null;
  const params = new URLSearchParams();
  if (next) {
    params.set("next", next);
  }
  if (intakeSessionId) {
    params.set("intakeSessionId", intakeSessionId);
  }
  const loginHref = params.size ? `/login?${params.toString()}` : "/login";

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{intakeSession ? "Create account to continue" : "Create your workspace"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signUpAction} className="space-y-5">
            {message ? (
              <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                {message}
              </div>
            ) : null}
            {intakeSession ? (
              <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                Continue with <span className="font-medium text-text">{intakeSession.file_name}</span> ({formatSize(intakeSession.file_size)}).
              </div>
            ) : null}
            <input name="next" type="hidden" value={next ?? ""} />
            <input name="intakeSessionId" type="hidden" value={intakeSessionId ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="company">Company name</Label>
              <Input id="company" name="companyName" placeholder="Lynch Interiors" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="Create a password" />
            </div>
            <Button className="w-full" type="submit">
              {intakeSession ? "Create account to continue" : "Create account"}
            </Button>
            <p className="text-sm text-muted">
              Already have an account?{" "}
              <a className="font-medium text-text underline-offset-4 hover:underline" href={loginHref}>
                Login
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
