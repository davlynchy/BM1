import { signInAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signInAction} className="space-y-5">
            {message ? (
              <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                {message}
              </div>
            ) : null}
            <input name="next" type="hidden" value={next ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="Password" />
            </div>
            <Button className="w-full" type="submit">
              Continue
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
    </main>
  );
}
