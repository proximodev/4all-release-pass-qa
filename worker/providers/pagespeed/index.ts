/**
 * PageSpeed Provider
 *
 * Exports:
 * - processPerformance: Performance test execution (Core Web Vitals)
 * - runPageSpeed: Low-level PageSpeed API client
 * - PageSpeedResult: Result type
 */

export { processPerformance } from './performance';
export { runPageSpeed, runPageSpeedBothViewports } from './client';
export type { PageSpeedResult, SeoAudit, Strategy } from './client';
