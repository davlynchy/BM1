import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SupportPage() {
  return (
    <main className="space-y-6">
      <header className="flex items-center justify-center py-4">
        <h1 className="font-heading text-5xl">Bidmetric</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Contact support at <a className="underline" href="mailto:support@bidmetric.com">support@bidmetric.com</a>.
        </CardContent>
      </Card>
    </main>
  );
}
