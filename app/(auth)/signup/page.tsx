import { signUpAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signUpAction} className="space-y-5">
            {message ? (
              <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                {message}
              </div>
            ) : null}
            <input name="next" type="hidden" value={next ?? ""} />
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
              Create account
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
