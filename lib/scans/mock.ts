type MockFinding = {
  severity: "low" | "medium" | "high";
  title: string;
  summary: string;
  implication: string;
  recommendedAction: string;
  citation: {
    section: string;
    snippet: string;
    page: number;
  };
};

type MockObligation = {
  category: string;
  title: string;
  dueRule: string;
  submissionPath: string;
  noticePeriodDays: number | null;
  citation: {
    section: string;
    snippet: string;
    page: number;
  };
};

export function generateMockScanPayload(fileName: string) {
  const normalizedName = fileName.toLowerCase();
  const containsFitout = normalizedName.includes("fitout");

  const summary = {
    executiveSummary:
      "Bidmetric identified several commercial controls that should be negotiated or operationally managed before work starts.",
    topThemes: [
      "strict notice requirements",
      "variation approval workflow",
      "broad indemnity and downstream risk",
    ],
    sourceFile: fileName,
  };

  const findings: MockFinding[] = [
    {
      severity: "high",
      title: "Strict time-bar on variations",
      summary:
        "The subcontract appears to require written notice shortly after a variation direction or event.",
      implication:
        "Failure to issue notice in time may prevent recovery even if the work is instructed and performed.",
      recommendedAction:
        "Align site and commercial teams on a same-day notice process and negotiate a more workable response period.",
      citation: {
        section: "Variations",
        snippet:
          "The subcontractor must give written notice within 5 business days of becoming aware of the change.",
        page: 14,
      },
    },
    {
      severity: "high",
      title: "Broad indemnity extending beyond scope",
      summary:
        "The indemnity language appears wider than the subcontractor's direct scope and fault position.",
      implication:
        "This can shift disproportionate downstream liability onto the subcontractor for events it does not control.",
      recommendedAction:
        "Narrow indemnity wording to losses caused by the subcontractor's breach, negligence, or acts.",
      citation: {
        section: "Indemnity",
        snippet: "The subcontractor indemnifies the contractor for all claims arising in connection with the works.",
        page: 22,
      },
    },
    {
      severity: containsFitout ? "medium" : "high",
      title: "Pay-when-paid mechanism risk",
      summary:
        "Payment timing appears linked to upstream certification or receipt, creating a cashflow risk.",
      implication:
        "Delayed upstream payment can materially affect working capital and dispute timing.",
      recommendedAction:
        "Check compatibility with security of payment rights and seek fixed certification/payment dates.",
      citation: {
        section: "Payment",
        snippet: "Payment is due within 7 days after the contractor receives payment from the principal.",
        page: 9,
      },
    },
    {
      severity: "medium",
      title: "Compressed EOT notice window",
      summary:
        "The draft contract uses a short initial notice period for delay events.",
      implication:
        "Site teams may miss the first notice, weakening extension and cost entitlements.",
      recommendedAction:
        "Set a standard project delay notice workflow and negotiate a longer initial notice period.",
      citation: {
        section: "Extensions of Time",
        snippet: "An initial delay notice must be submitted within 2 business days.",
        page: 18,
      },
    },
    {
      severity: "medium",
      title: "Set-off discretion is broad",
      summary:
        "The contractor appears to retain broad discretion to withhold or set off amounts.",
      implication:
        "This can impact monthly claim certainty and force disputes into the payment cycle.",
      recommendedAction:
        "Seek objective triggers and notice requirements before any set-off can be applied.",
      citation: {
        section: "Set-off",
        snippet: "The contractor may deduct any amount it reasonably determines is owing.",
        page: 11,
      },
    },
  ];

  const obligations: MockObligation[] = [
    {
      category: "Payment Claims",
      title: "Monthly payment claim",
      dueRule: "Submit on the 25th day of each month",
      submissionPath: "Payapps",
      noticePeriodDays: null,
      citation: {
        section: "Payment",
        snippet: "Progress claims must be submitted on the 25th day of each month via Payapps.",
        page: 8,
      },
    },
    {
      category: "Variations",
      title: "Variation notice",
      dueRule: "Within 5 business days of becoming aware",
      submissionPath: "Written notice to contractor representative",
      noticePeriodDays: 5,
      citation: {
        section: "Variations",
        snippet: "Written notice is required within 5 business days.",
        page: 14,
      },
    },
    {
      category: "EOT",
      title: "Initial delay notice",
      dueRule: "Within 2 business days of the delay event",
      submissionPath: "Email notice to project manager",
      noticePeriodDays: 2,
      citation: {
        section: "Extensions of Time",
        snippet: "Initial notice within 2 business days, detailed claim within 10 business days.",
        page: 18,
      },
    },
  ];

  return { summary, findings, obligations };
}
