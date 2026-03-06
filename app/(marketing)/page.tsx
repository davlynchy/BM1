import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChartColumn,
  ChevronDown,
  FilePenLine,
  FileSearch,
  Files,
  FolderKanban,
  Mail,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { TradeImpactCalculator } from "@/components/marketing/trade-impact-calculator";
import { Button } from "@/components/ui/button";

const featureCards = [
  {
    icon: FolderKanban,
    title: "Project Dashboard",
    description:
      "Track every live contract by project, owner, and key commercial deadlines in one place.",
  },
  {
    icon: FileSearch,
    title: "Commercial Risk Scan",
    description:
      "AI flags pay-when-paid clauses, notice traps, set-off exposure, and commercial blind spots.",
  },
  {
    icon: ChartColumn,
    title: "Key Date Intelligence",
    description:
      "Surface notice periods, variation timing, payment milestones, and critical admin triggers.",
  },
  {
    icon: MessageSquareQuote,
    title: "Contract Q&A",
    description:
      "Ask clause-specific questions and get fast answers grounded in your uploaded contract set.",
  },
  {
    icon: FilePenLine,
    title: "Draft Correspondence",
    description:
      "Generate variation notices, EOT drafts, and follow-up emails with the right clause context.",
  },
  {
    icon: Mail,
    title: "Email Integration",
    description:
      "Capture key commercial communications and connect them back to the project record.",
  },
  {
    icon: Files,
    title: "Document Vault",
    description:
      "Keep contracts, drawings, variations, and supporting records in a secure indexed workspace.",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    description:
      "Get a second commercial read before you respond, approve, or walk into a claim review.",
  },
];

const lifecycleCards = [
  {
    icon: Files,
    title: "Tender",
    description: "Assess risk before you commit.",
  },
  {
    icon: ShieldCheck,
    title: "Pre-Contract",
    description: "Spot negotiation traps and key dates.",
  },
  {
    icon: FilePenLine,
    title: "Construction",
    description: "Draft, track, and defend live claims.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Post-Construction",
    description: "Final account closeout with full records.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload",
    description: "Drag in your subcontract or project documents. PDF, Word, or Excel.",
  },
  {
    number: "02",
    title: "Scan",
    description: "AI identifies risk clauses, extracts key dates, and flags commercial exposure.",
  },
  {
    number: "03",
    title: "Manage",
    description: "Track projects from tender to account closeout with every document in one place.",
  },
  {
    number: "04",
    title: "Act",
    description: "Ask questions, draft RFIs, register variations, and respond with clause-backed context.",
  },
];

const testimonials = [
  {
    quote:
      "We recovered variation value we would have missed because the notice risk showed up before the claim went stale.",
    author: "Sarah Mitchell",
    role: "Senior Commercial Manager, Precision Mechanical Services",
  },
  {
    quote:
      "Our CA team now spends minutes, not hours, pulling clause references and key dates before issuing correspondence.",
    author: "James Thornton",
    role: "Director, Thornton Electrical Group",
  },
  {
    quote:
      "The email integration helped us tie a disputed instruction back to the project record before final account negotiations.",
    author: "Rachel Nguyen",
    role: "Contracts Administrator, Ace Fluid & Fire Services",
  },
];

const pricingItems = [
  "Unlimited contract uploads",
  "AI risk scan on every document",
  "Contract Q&A assistant",
  "Email and correspondence drafting",
  "Secure document vault",
  "Unlimited projects",
];

const faqs = [
  {
    question: "What types of contracts does Bidmetric support?",
    answer:
      "Bidmetric is built for subcontractor workflows and supports common construction contract formats including PDFs, Word documents, spreadsheets, email files, and supporting project records.",
  },
  {
    question: "Is my contract data secure?",
    answer:
      "Uploaded files are stored in the project workspace with authenticated access controls. Teams only see the projects and documents they have permission to access.",
  },
  {
    question: "How accurate is the AI risk scan?",
    answer:
      "The scan is designed to accelerate commercial review by surfacing likely risk areas, key dates, and clause-linked context. It is best used as a first-pass review for your commercial team, not as a legal opinion.",
  },
  {
    question: "Can multiple team members use Bidmetric?",
    answer:
      "Yes. Bidmetric is intended for commercial managers, contract administrators, quantity surveyors, and directors working across the same project portfolio.",
  },
  {
    question: "Do I need to install any software?",
    answer:
      "No. The platform runs in the browser, so your team can upload, review, and manage contract records without a desktop install.",
  },
  {
    question: "What happens after my free contract scan?",
    answer:
      "The free scan returns an immediate summary. When you log in, Bidmetric creates a saved workspace so you can keep the project, documents, and follow-up actions together.",
  },
];

export default function LandingPage() {
  const startHref = "/login?next=%2Fapp";

  return (
    <main className="bg-[#f6f7f2] text-text">
      <section className="px-4 pb-16 pt-6 md:px-6 md:pb-24">
        <div className="mx-auto max-w-[1160px]">
          <header className="flex items-center justify-between gap-6 rounded-full border border-[#e1e5da] bg-[#fbfcf8]/90 px-5 py-4 shadow-[0_18px_40px_rgba(25,39,32,0.05)] backdrop-blur md:px-8">
            <Link className="font-heading text-2xl tracking-tight text-[#22382f]" href="/">
              BIDMETRIC
            </Link>
            <nav className="hidden items-center gap-8 text-sm text-[#778075] md:flex">
              <Link href="#features">Features</Link>
              <Link href="#how-it-works">How It Works</Link>
              <Link href="#pricing">Pricing</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link className="hidden text-sm text-[#22382f] sm:block" href="/login">
                Sign In
              </Link>
              <Button
                asChild
                className="rounded-full bg-[#234838] px-5 shadow-[0_10px_24px_rgba(35,72,56,0.2)] hover:bg-[#1c3a2d]"
                size="sm"
              >
                <Link href={startHref}>Get Started</Link>
              </Button>
            </div>
          </header>

          <div className="mx-auto flex max-w-[760px] flex-col items-center px-4 pb-6 pt-14 text-center md:pt-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e0ead3] bg-[#eef6e5] px-4 py-2 text-sm font-medium text-[#6f8658]">
              <BadgeCheck className="h-4 w-4" />
              AI Read Layer for Subcontractors
            </div>
            <h1 className="mt-8 font-heading text-[3.4rem] leading-[0.95] tracking-tight text-[#25362e] md:text-[5.8rem]">
              Commercial
              <br />
              Intelligence for
              <br />
              <span className="text-[#7cb342]">Subcontractors</span>
            </h1>
            <p className="mt-6 max-w-[580px] text-lg leading-8 text-[#747d72] md:text-xl">
              One platform to manage projects, scan contracts for risk, track key dates,
              draft correspondence, and keep your commercial team ahead.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                className="rounded-full bg-[#234838] px-7 shadow-[0_14px_24px_rgba(35,72,56,0.2)] hover:bg-[#1c3a2d]"
                size="lg"
              >
                <Link href={startHref}>
                  Start Your Project
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6 md:py-24" id="features">
        <div className="mx-auto max-w-[1160px]">
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className="font-heading text-5xl leading-tight text-[#29362f] md:text-6xl">
              Everything your commercial team needs
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#788176]">
              A fully integrated platform built for busy commercial managers, contract
              administrators, quantity surveyors, and directors at subcontractor firms.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <article
                className="rounded-[28px] border border-[#e5e8de] bg-white p-6 shadow-[0_18px_40px_rgba(25,39,32,0.04)]"
                key={title}
              >
                <div className="inline-flex rounded-2xl bg-[#274c3b] p-3 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-heading text-2xl leading-tight text-[#29362f]">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#778075]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#214636] px-4 py-16 text-white md:px-6 md:py-24">
        <div className="mx-auto max-w-[1160px]">
          <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
            <div className="max-w-[460px]">
              <h2 className="font-heading text-5xl leading-tight md:text-6xl">
                Your commercial command centre
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/70">
                One dashboard to manage every project across its lifecycle. Whether
                you&apos;re a commercial manager tracking ten live sites or a director
                reviewing the entire portfolio, Bidmetric keeps everything in view.
              </p>
              <Button
                asChild
                className="mt-8 rounded-full border-white/15 bg-white/6 px-6 text-white hover:bg-white/10"
                variant="secondary"
              >
                <Link href={startHref}>
                  See it in action
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {lifecycleCards.map(({ icon: Icon, title, description }) => (
                <article
                  className="rounded-[28px] border border-white/8 bg-white/8 p-6 shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
                  key={title}
                >
                  <div className="inline-flex rounded-2xl bg-[#315846] p-3 text-brand2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 font-heading text-2xl leading-tight">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/65">{description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-[860px] text-center">
            <h2 className="font-heading text-5xl leading-tight md:text-6xl">
              What&apos;s one missed variation costing you?
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Select your trade to see the real cost of missed claims.
            </p>
            <div className="mt-10">
              <TradeImpactCalculator />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6 md:py-24" id="how-it-works">
        <div className="mx-auto max-w-[1160px]">
          <div className="text-center">
            <h2 className="font-heading text-5xl leading-tight text-[#29362f] md:text-6xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-[#788176]">Four steps. No training required.</p>
          </div>

          <div className="mt-12 border-t border-[#dbe0d4] pt-10">
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step) => (
                <article key={step.number}>
                  <p className="font-heading text-5xl leading-none text-[#c3d6a8]">
                    {step.number}
                  </p>
                  <h3 className="mt-4 font-heading text-3xl text-[#2c3730]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#778075]">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-[1160px]">
          <div className="text-center">
            <h2 className="font-heading text-5xl leading-tight text-[#29362f] md:text-6xl">
              Trusted by subcontractors
            </h2>
            <p className="mt-4 text-lg text-[#788176]">Real results from real commercial teams.</p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <article
                className="rounded-[28px] border border-[#e5e8de] bg-white p-7 shadow-[0_18px_40px_rgba(25,39,32,0.04)]"
                key={testimonial.author}
              >
                <div className="inline-flex rounded-full bg-[#eef6e5] p-3 text-[#95b86b]">
                  <MessageSquareQuote className="h-5 w-5" />
                </div>
                <p className="mt-5 text-base leading-8 text-[#4f5a53]">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-6 border-t border-[#edf0e7] pt-5">
                  <p className="font-medium text-[#29362f]">{testimonial.author}</p>
                  <p className="mt-1 text-sm leading-6 text-[#788176]">{testimonial.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6 md:py-24" id="pricing">
        <div className="mx-auto max-w-[1160px]">
          <div className="text-center">
            <h2 className="font-heading text-5xl leading-tight text-[#29362f] md:text-6xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-[#788176]">One plan. Everything included.</p>
          </div>

          <div className="mt-12 flex justify-center">
            <article className="w-full max-w-[420px] rounded-[32px] border border-[#e5e8de] bg-white p-8 text-center shadow-[0_20px_50px_rgba(25,39,32,0.08)]">
              <p className="font-heading text-7xl leading-none text-[#29362f]">$200</p>
              <p className="mt-2 text-base text-[#778075]">/month</p>
              <p className="mt-4 text-sm font-medium text-[#7aa940]">$2,000/year (save 2 months)</p>
              <ul className="mt-8 space-y-4 text-left">
                {pricingItems.map((item) => (
                  <li className="flex items-center gap-3 text-[#4f5a53]" key={item}>
                    <BadgeCheck className="h-5 w-5 shrink-0 text-[#8bbd48]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-10 w-full rounded-full bg-[#234838] py-6 text-base shadow-[0_14px_24px_rgba(35,72,56,0.2)] hover:bg-[#1c3a2d]"
                size="lg"
              >
                <Link href={startHref}>Get Started</Link>
              </Button>
              <p className="mt-4 text-xs text-[#8a9389]">Free contract assessment to try. No credit card required.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6 md:py-24" id="faq">
        <div className="mx-auto max-w-[1160px]">
          <div className="text-center">
            <h2 className="font-heading text-5xl leading-tight text-[#29362f] md:text-6xl">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-lg text-[#788176]">
              Everything you need to know about Bidmetric.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-[980px] space-y-4">
            {faqs.map((faq) => (
              <details
                className="group rounded-[24px] border border-[#dfe4d8] bg-white px-6 py-5 shadow-[0_12px_24px_rgba(25,39,32,0.03)]"
                key={faq.question}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-heading text-2xl text-[#29362f] [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" />
                </summary>
                <p className="pt-4 text-base leading-8 text-[#778075]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#dde1d8] px-4 py-10 md:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <Link className="font-heading text-2xl text-[#22382f]" href="/">
            BIDMETRIC
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-8 text-[#788176] md:justify-start">
            <Link href="#pricing">Pricing</Link>
            <Link href="#features">Features</Link>
            <Link href="mailto:hello@bidmetric.com">Contact</Link>
          </div>
          <p className="text-[#8a9389]">Copyright 2026 Bidmetric. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
