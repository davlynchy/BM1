import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const workspace = await getActiveWorkspace();
  const companyId = workspace?.company?.id;

  const { data: subscription } = companyId
    ? await supabase
        .from("billing_subscriptions")
        .select("status, stripe_price_id, current_period_end")
        .eq("company_id", companyId)
        .maybeSingle()
    : { data: null };

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-2">
          <div>
            <p className="font-medium text-text">Company name</p>
            <p>{workspace?.company?.name ?? "Not set"}</p>
          </div>
          <div>
            <p className="font-medium text-text">Workspace slug</p>
            <p>{workspace?.company?.slug ?? "Not set"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-2">
          <div>
            <p className="font-medium text-text">Email</p>
            <p>{workspace?.profile?.email ?? "Not set"}</p>
          </div>
          <div>
            <p className="font-medium text-text">Full name</p>
            <p>{workspace?.profile?.full_name || "Not set"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-3">
          <div>
            <p className="font-medium text-text">Status</p>
            <p>{subscription?.status ?? "inactive"}</p>
          </div>
          <div>
            <p className="font-medium text-text">Plan</p>
            <p>{subscription?.stripe_price_id ?? "Not connected"}</p>
          </div>
          <div>
            <p className="font-medium text-text">Current period end</p>
            <p>{subscription?.current_period_end ?? "Not available"}</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
