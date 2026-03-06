import { signInAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicIntakeSessionSummary } from "@/lib/intake/session";

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function LoginPage({
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
  const signupHref = params.size ? `/signup?${params.toString()}` : "/signup";

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <div className="w-full max-w-md space-y-6">
        <p className="text-center font-heading text-5xl tracking-wide text-text">BIDMETRIC</p>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{intakeSession ? "Log in to continue" : "Login"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={signInAction} className="space-y-5">
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
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a className="text-xs font-medium text-muted underline-offset-4 hover:text-text hover:underline" href="/forgot-password">
                    Forgot password?
                  </a>
                </div>
                <Input id="password" name="password" type="password" placeholder="Password" />
              </div>
              <Button className="w-full" type="submit">
                {intakeSession ? "Log in to continue" : "Continue"}
              </Button>
              <p className="text-sm text-muted">
                Need an account?{" "}
                <a className="font-medium text-text underline-offset-4 hover:underline" href={signupHref}>
                  Sign up
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
