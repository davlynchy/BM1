type ProjectFilterInput = {
  id: string;
  name: string;
  status: string | null;
  created_at?: string | null;
  contract_value?: number | null;
  site_due_date?: string | null;
  claim_submission_method?: string | null;
  variation_process?: string | null;
  indexedDocuments?: number;
  totalDocuments?: number;
  latestScanStatus?: string | null;
  highRiskCount?: number;
};

export type ProjectFilters = {
  q: string;
  status: string;
  scan: string;
  risk: string;
  sort: string;
  page: number;
};

export function normalizeProjectFilters(input: {
  q?: string;
  status?: string;
  scan?: string;
  risk?: string;
  sort?: string;
  page?: string;
}): ProjectFilters {
  const parsedPage = Number(input.page ?? "1");

  return {
    q: input.q?.trim() ?? "",
    status: input.status?.trim() ?? "all",
    scan: input.scan?.trim() ?? "all",
    risk: input.risk?.trim() ?? "all",
    sort: input.sort?.trim() ?? "updated_desc",
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1,
  };
}

export function filterProjects<T extends ProjectFilterInput>(projects: T[], filters: ProjectFilters) {
  return projects.filter((project) => {
    const haystack = [
      project.name,
      project.claim_submission_method ?? "",
      project.variation_process ?? "",
    ]
      .join(" ")
      .toLowerCase();

    if (filters.q && !haystack.includes(filters.q.toLowerCase())) {
      return false;
    }

    if (filters.status !== "all" && (project.status ?? "") !== filters.status) {
      return false;
    }

    if (filters.scan !== "all" && (project.latestScanStatus ?? "none") !== filters.scan) {
      return false;
    }

    if (filters.risk === "high" && (project.highRiskCount ?? 0) === 0) {
      return false;
    }

    if (filters.risk === "clear" && (project.highRiskCount ?? 0) > 0) {
      return false;
    }

    return true;
  });
}

export function sortProjects<T extends ProjectFilterInput>(projects: T[], sort: string) {
  const sorted = [...projects];

  switch (sort) {
    case "name_asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      return sorted;
    case "contract_desc":
      sorted.sort((a, b) => (b.contract_value ?? 0) - (a.contract_value ?? 0));
      return sorted;
    case "risk_desc":
      sorted.sort((a, b) => (b.highRiskCount ?? 0) - (a.highRiskCount ?? 0));
      return sorted;
    case "site_asc":
      sorted.sort((a, b) => {
        const aTime = a.site_due_date ? new Date(a.site_due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.site_due_date ? new Date(b.site_due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
      return sorted;
    case "updated_desc":
    default:
      sorted.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      return sorted;
  }
}

export function paginateProjects<T>(projects: T[], page: number, pageSize: number) {
  const totalItems = projects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: projects.slice(start, start + pageSize),
    totalItems,
    totalPages,
    currentPage,
  };
}

export function buildProjectQuery(filters: Partial<ProjectFilters>) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.scan && filters.scan !== "all") params.set("scan", filters.scan);
  if (filters.risk && filters.risk !== "all") params.set("risk", filters.risk);
  if (filters.sort && filters.sort !== "updated_desc") params.set("sort", filters.sort);
  if (filters.page && filters.page !== 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}
