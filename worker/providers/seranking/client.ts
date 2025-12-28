/**
 * SE Ranking Website Audit API Client
 *
 * Documentation: https://seranking.com/api/data/website-audit/
 *
 * Features:
 * - 105 checks across security, crawling, redirects, sitemap, meta tags, etc.
 * - Full site crawl up to 500 pages
 * - Returns health score (0-100)
 */

import { retryWithBackoff } from '../../lib/retry';

const API_BASE = 'https://api4.seranking.com';

export interface SeRankingAuditResult {
  projectId: string;
  auditId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  score: number | null;
  pagesScanned: number;
  issues: SeRankingIssue[];
  summary: {
    criticalCount: number;
    warningsCount: number;
    noticesCount: number;
    passedCount: number;
  };
}

export interface SeRankingIssue {
  id: string;
  name: string;
  category: string;
  severity: 'critical' | 'warning' | 'notice' | 'passed';
  affectedCount: number;
  description: string;
  urls?: string[];
}

export interface SeRankingProject {
  id: string;
  name: string;
  url: string;
  status: string;
}

/**
 * Create a new audit project in SE Ranking
 */
export async function createAuditProject(
  siteUrl: string,
  options: {
    maxPages?: number;
    includeSubdomains?: boolean;
  } = {}
): Promise<SeRankingProject> {
  const apiKey = process.env.SE_RANKING_API_KEY;

  if (!apiKey) {
    throw new Error('SE_RANKING_API_KEY environment variable is not set');
  }

  const { maxPages = 500, includeSubdomains = false } = options;

  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(`${API_BASE}/audit/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: siteUrl,
          max_pages: maxPages,
          include_subdomains: includeSubdomains,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const error = new Error(`SE Ranking API error: ${res.status} - ${errorBody}`) as any;
        error.status = res.status;

        // Don't retry on auth errors
        if (res.status === 401 || res.status === 403) {
          error.noRetry = true;
        }

        throw error;
      }

      return res.json() as Promise<{ id: string; name?: string; status: string }>;
    },
    { maxRetries: 3, initialDelayMs: 1000 }
  );

  return {
    id: response.id,
    name: response.name || siteUrl,
    url: siteUrl,
    status: response.status,
  };
}

/**
 * Start an audit for a project
 */
export async function startAudit(projectId: string): Promise<string> {
  const apiKey = process.env.SE_RANKING_API_KEY;

  if (!apiKey) {
    throw new Error('SE_RANKING_API_KEY environment variable is not set');
  }

  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(`${API_BASE}/audit/projects/${projectId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`SE Ranking API error: ${res.status} - ${errorBody}`);
      }

      return res.json() as Promise<{ audit_id: string }>;
    },
    { maxRetries: 3, initialDelayMs: 1000 }
  );

  return response.audit_id;
}

interface AuditStatusResponse {
  status: string;
  score?: number;
  pages_scanned?: number;
  critical_count?: number;
  warnings_count?: number;
  notices_count?: number;
  passed_count?: number;
}

/**
 * Get audit status and results
 */
export async function getAuditResults(
  projectId: string,
  auditId: string
): Promise<SeRankingAuditResult> {
  const apiKey = process.env.SE_RANKING_API_KEY;

  if (!apiKey) {
    throw new Error('SE_RANKING_API_KEY environment variable is not set');
  }

  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(`${API_BASE}/audit/projects/${projectId}/audits/${auditId}`, {
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`SE Ranking API error: ${res.status} - ${errorBody}`);
      }

      return res.json() as Promise<AuditStatusResponse>;
    },
    { maxRetries: 3, initialDelayMs: 1000 }
  );

  return parseAuditResponse(projectId, auditId, response);
}

interface IssuesResponse {
  issues?: Array<{
    id: string;
    name: string;
    category: string;
    severity: string;
    affected_count?: number;
    description?: string;
    urls?: string[];
  }>;
}

/**
 * Get list of issues from an audit
 */
export async function getAuditIssues(
  projectId: string,
  auditId: string
): Promise<SeRankingIssue[]> {
  const apiKey = process.env.SE_RANKING_API_KEY;

  if (!apiKey) {
    throw new Error('SE_RANKING_API_KEY environment variable is not set');
  }

  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(`${API_BASE}/audit/projects/${projectId}/audits/${auditId}/issues`, {
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`SE Ranking API error: ${res.status} - ${errorBody}`);
      }

      return res.json() as Promise<IssuesResponse>;
    },
    { maxRetries: 3, initialDelayMs: 1000 }
  );

  return (response.issues || []).map((issue) => ({
    id: issue.id,
    name: issue.name,
    category: issue.category,
    severity: mapSeverity(issue.severity),
    affectedCount: issue.affected_count || 0,
    description: issue.description || '',
    urls: issue.urls,
  }));
}

/**
 * Poll for audit completion
 */
export async function waitForAuditCompletion(
  projectId: string,
  auditId: string,
  options: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
  } = {}
): Promise<SeRankingAuditResult> {
  const { pollIntervalMs = 30000, maxWaitMs = 3600000 } = options;  // Default: poll every 30s, max 1 hour

  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await getAuditResults(projectId, auditId);

    if (result.status === 'completed' || result.status === 'failed') {
      return result;
    }

    console.log(`[SE_RANKING] Audit ${auditId} status: ${result.status}, pages scanned: ${result.pagesScanned}`);

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Audit timed out after ${maxWaitMs / 1000} seconds`);
}

/**
 * Run a complete audit (create project, start, wait for completion)
 */
export async function runFullAudit(
  siteUrl: string,
  options: {
    maxPages?: number;
    pollIntervalMs?: number;
    maxWaitMs?: number;
  } = {}
): Promise<SeRankingAuditResult> {
  console.log(`[SE_RANKING] Starting full audit for ${siteUrl}`);

  // Create project
  const project = await createAuditProject(siteUrl, { maxPages: options.maxPages });
  console.log(`[SE_RANKING] Created project ${project.id}`);

  // Start audit
  const auditId = await startAudit(project.id);
  console.log(`[SE_RANKING] Started audit ${auditId}`);

  // Wait for completion
  const result = await waitForAuditCompletion(project.id, auditId, options);

  // Get detailed issues
  if (result.status === 'completed') {
    result.issues = await getAuditIssues(project.id, auditId);
  }

  return result;
}

/**
 * Parse SE Ranking audit response
 */
function parseAuditResponse(projectId: string, auditId: string, response: AuditStatusResponse): SeRankingAuditResult {
  return {
    projectId,
    auditId,
    status: mapStatus(response.status),
    score: response.score ?? null,
    pagesScanned: response.pages_scanned || 0,
    issues: [],  // Issues are fetched separately
    summary: {
      criticalCount: response.critical_count || 0,
      warningsCount: response.warnings_count || 0,
      noticesCount: response.notices_count || 0,
      passedCount: response.passed_count || 0,
    },
  };
}

function mapStatus(status: string): 'pending' | 'in_progress' | 'completed' | 'failed' {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
      return 'completed';
    case 'in_progress':
    case 'running':
      return 'in_progress';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}

function mapSeverity(severity: string): 'critical' | 'warning' | 'notice' | 'passed' {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'error':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'notice':
    case 'info':
      return 'notice';
    case 'passed':
    case 'ok':
      return 'passed';
    default:
      return 'notice';
  }
}
