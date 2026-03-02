import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  "Payment claim process",
  "Variation procedure",
  "EOT notice windows",
  "Liquidated damages exposure",
  "Termination rights",
  "Indemnity scope",
];

const risks = [
  "Pay-when-paid clause",
  "Broad indemnities",
  "Notice traps",
  "Set-off provisions",
  "Security of payment vulnerabilities",
];

export default function LandingPage() {
  return (
    <main>
      <section className="container py-8">
        <header className="flex items-center justify-between rounded-xl border border-border bg-panel px-5 py-4 shadow-panel">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand text-center font-[var(--font-heading)] text-lg leading-10 text-white">
              B
            </div>
            <div>
              <p className="font-[var(--font-heading)] text-xl">Bidmetric</p>
              <p className="text-sm text-muted">Commercial intelligence for subcontractors</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <Link className="text-sm text-muted" href="/login">
              Login
            </Link>
            <Button asChild size="sm">
              <Link href="/upload">Run Free Contract Scan</Link>
            </Button>
          </nav>
        </header>
      </section>

      <section className="container grid gap-8 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6">
          <Badge>Commercial Intelligence for Construction Contractors</Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl font-[var(--font-heading)] text-5xl leading-tight text-balance">
              Stop signing subcontracts blind.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted">
              Upload a subcontract and receive a structured commercial risk summary in
              minutes. Built for contract administrators, QSs, commercial managers and
              directors.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/upload">
                Run Free Contract Scan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Link
              className="text-sm font-medium text-muted underline-offset-4 hover:underline"
              href="#example-report"
            >
              View Example Report
            </Link>
          </div>
          <p className="text-sm text-muted">
            Free summary. Full report available after login.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Commercial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-bg p-4">
              <p className="text-sm font-semibold">Payment Claims</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                <li>Claims due 25th monthly</li>
                <li>Submission via Payapps</li>
                <li>Certification within 10 business days</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-bg p-4">
              <p className="text-sm font-semibold">Top Risks Identified</p>
              <ol className="mt-2 space-y-2 text-sm text-muted">
                <li>1. Pay-When-Paid Clause (High)</li>
                <li>2. Broad Indemnity Extending Beyond Scope (High)</li>
                <li>3. Strict Time-Bar on Variations (Medium)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container grid gap-6 py-10 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Extracts What Matters</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted">
              {features.map((feature) => (
                <li className="flex items-center gap-2" key={feature}>
                  <CheckCircle2 className="h-4 w-4 text-brand" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card id="example-report">
          <CardHeader>
            <CardTitle>Flags Commercial Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted">
              {risks.map((risk) => (
                <li className="flex items-center gap-2" key={risk}>
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  {risk}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recommends Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            <p>Why it matters commercially.</p>
            <p>What to negotiate.</p>
            <p>What to protect operationally.</p>
            <p>Draft negotiation guidance in the paid workspace.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
