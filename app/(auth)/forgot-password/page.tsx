import { requestPasswordResetAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <div className="w-full max-w-md space-y-6">
        <p className="text-center font-heading text-5xl tracking-wide text-text">BIDMETRIC</p>
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={requestPasswordResetAction} className="space-y-5">
              {message ? (
                <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                  {message}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" placeholder="you@company.com" type="email" />
              </div>
              <Button className="w-full" type="submit">
                Send reset email
              </Button>
              <p className="text-sm text-muted">
                Back to{" "}
                <a className="font-medium text-text underline-offset-4 hover:underline" href="/login">
                  Login
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
