export type ScanSummary = {
  executiveSummary: string;
  topThemes: string[];
  confidence: "low" | "medium" | "high";
  negotiationPoints?: string[];
  priorityActions?: string[];
  clausesNeedingLegalReview?: string[];
  currentStage?: string;
  stagesCompleted?: string[];
  lastProgressMessage?: string;
  quickReviewCompletedAt?: string;
  deepReviewCompletedAt?: string;
};

export type ScanCitation = {
  page: number;
  section: string;
  snippet: string;
  chunkIndex?: number;
};

export type ScanFinding = {
  severity: "low" | "medium" | "high";
  title: string;
  summary: string;
  implication: string;
  recommendedAction: string;
  citation: ScanCitation;
};

export type ContractObligation = {
  category: string;
  title: string;
  dueRule: string;
  submissionPath: string;
  noticePeriodDays: number | null;
  citation: ScanCitation;
};

export type ContractScanExtraction = {
  summary: ScanSummary;
  findings: ScanFinding[];
  obligations: ContractObligation[];
};

export type QuickReviewResult = {
  summary: ScanSummary;
  findings: ScanFinding[];
};
