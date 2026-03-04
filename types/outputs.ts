export type ProjectOutputType = "email" | "memo" | "summary" | "checklist";

export type ProjectOutputStatus = "draft" | "published" | "archived";

export type ProjectOutputRecord = {
  id: string;
  companyId: string;
  projectId: string | null;
  threadId: string | null;
  sourceRunId: string | null;
  type: ProjectOutputType;
  title: string;
  body: string;
  status: ProjectOutputStatus;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProjectOutputVersion = {
  id: string;
  outputId: string;
  version: number;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
