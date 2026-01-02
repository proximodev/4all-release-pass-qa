/**
 * Shared type definitions for ReleasePass components
 *
 * These types represent the API response shapes used across
 * TestResultsSummary, TestResultDetail, and TestSelector components.
 */

/**
 * Project summary included in release run responses
 */
export interface ProjectSummary {
  id: string
  name: string
  siteUrl: string
}

/**
 * Individual check result from a test provider
 */
export interface ResultItem {
  id: string
  provider?: string
  code: string
  name: string
  status: string
  severity?: string
  meta?: Record<string, any>
}

/**
 * Per-URL test results
 */
export interface UrlResultData {
  id: string
  url: string
  viewport?: string | null
  issueCount?: number
  additionalMetrics?: Record<string, any>
  resultItems?: ResultItem[]
  preflightScore?: number | null
  performanceScore?: number | null
}

/**
 * Test run data with optional URL results
 */
export interface TestRunData {
  id: string
  type: string
  status: string
  score: number | null
  createdAt: string
  finishedAt?: string | null
  urlResults?: UrlResultData[]
  _count?: {
    urlResults: number
  }
  project?: ProjectSummary
}

/**
 * Simplified test run for selector lists
 */
export interface TestRunSummary {
  id: string
  type: string
  status: string
  score: number | null
  createdAt: string
}

/**
 * Release run with associated test runs
 */
export interface ReleaseRun {
  id: string
  name: string | null
  status: string
  urls: string[]
  selectedTests: string[]
  createdAt: string
  testRuns: TestRunData[]
  project: ProjectSummary
}

/**
 * Simplified release run for selector lists
 */
export interface ReleaseRunSummary {
  id: string
  name: string | null
  status: string
  createdAt: string
  testRuns: TestRunSummary[]
}
