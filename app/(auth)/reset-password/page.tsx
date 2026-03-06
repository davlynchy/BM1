import { updatePasswordAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPasswordPage({
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
            <CardTitle>Set new password</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePasswordAction} className="space-y-5">
              {message ? (
                <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                  {message}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                  Enter your new password.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" placeholder="New password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" name="confirmPassword" placeholder="Confirm password" type="password" />
              </div>
              <Button className="w-full" type="submit">
                Update password
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
