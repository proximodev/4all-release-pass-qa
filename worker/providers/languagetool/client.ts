/**
 * LanguageTool API Client
 *
 * Supports both:
 * - Self-hosted instance (LANGUAGETOOL_URL env var)
 * - Cloud API (LANGUAGETOOL_API_KEY env var)
 *
 * Self-hosted is recommended for unlimited requests.
 * Cloud API has rate limits based on subscription tier.
 */

import { retryWithBackoff } from '../../lib/retry';
import { fetchWithTimeout } from '../../lib/fetch';

// Default to public API, but self-hosted is preferred
const DEFAULT_API_URL = 'https://api.languagetool.org/v2';

export interface SpellingMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
  context: {
    text: string;
    offset: number;
    length: number;
  };
  sentence: string;
  rule: {
    id: string;
    description: string;
    category: {
      id: string;
      name: string;
    };
    issueType: string;
  };
}

export interface SpellingCheckResult {
  matches: SpellingMatch[];
  language: {
    code: string;
    name: string;
    detectedLanguage?: {
      code: string;
      name: string;
      confidence: number;
    };
  };
}

export interface CheckOptions {
  language?: string;  // e.g., 'en-US', 'auto' for auto-detect
  disabledRules?: string[];
  disabledCategories?: string[];
}

/**
 * Get the LanguageTool API base URL
 */
function getApiUrl(): string {
  return process.env.LANGUAGETOOL_URL || DEFAULT_API_URL;
}

/**
 * Check if we're using a self-hosted instance
 */
function isSelfHosted(): boolean {
  return !!process.env.LANGUAGETOOL_URL;
}

/**
 * Check text for spelling and grammar issues
 */
export async function checkSpelling(
  text: string,
  options: CheckOptions = {}
): Promise<SpellingCheckResult> {
  const apiUrl = getApiUrl();
  const apiKey = process.env.LANGUAGETOOL_API_KEY;

  // Validate configuration
  if (!isSelfHosted() && !apiKey) {
    throw new Error(
      'LanguageTool not configured. Set LANGUAGETOOL_URL for self-hosted or LANGUAGETOOL_API_KEY for cloud API.'
    );
  }

  // Prepare request body
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('language', options.language || 'auto');

  // Add API key if using cloud API
  if (apiKey && !isSelfHosted()) {
    params.set('apiKey', apiKey);
  }

  // Add disabled rules/categories if specified
  if (options.disabledRules?.length) {
    params.set('disabledRules', options.disabledRules.join(','));
  }
  if (options.disabledCategories?.length) {
    params.set('disabledCategories', options.disabledCategories.join(','));
  }

  const checkUrl = `${apiUrl}/check`;

  const response = await retryWithBackoff(
    async () => {
      const res = await fetchWithTimeout(checkUrl, {
        timeoutMs: 30000,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        const errorBody = await res.text();

        // Don't retry on 4xx errors (except 429 rate limit)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          const error = new Error(`LanguageTool API error: ${res.status} - ${errorBody}`) as any;
          error.status = res.status;
          error.noRetry = true;
          throw error;
        }

        throw new Error(`LanguageTool API error: ${res.status} - ${errorBody}`);
      }

      return res.json();
    },
    { maxRetries: 3, initialDelayMs: 1000 }
  );

  return parseResponse(response);
}

/**
 * Parse LanguageTool API response
 */
function parseResponse(response: any): SpellingCheckResult {
  const matches: SpellingMatch[] = (response.matches || []).map((m: any) => ({
    message: m.message || '',
    shortMessage: m.shortMessage || '',
    offset: m.offset || 0,
    length: m.length || 0,
    replacements: (m.replacements || []).slice(0, 5).map((r: any) => r.value || r),
    context: {
      text: m.context?.text || '',
      offset: m.context?.offset || 0,
      length: m.context?.length || 0,
    },
    sentence: m.sentence || '',
    rule: {
      id: m.rule?.id || 'UNKNOWN',
      description: m.rule?.description || '',
      category: {
        id: m.rule?.category?.id || 'UNKNOWN',
        name: m.rule?.category?.name || 'Unknown',
      },
      issueType: m.rule?.issueType || 'misspelling',
    },
  }));

  return {
    matches,
    language: {
      code: response.language?.code || 'unknown',
      name: response.language?.name || 'Unknown',
      detectedLanguage: response.language?.detectedLanguage
        ? {
            code: response.language.detectedLanguage.code,
            name: response.language.detectedLanguage.name,
            confidence: response.language.detectedLanguage.confidence || 0,
          }
        : undefined,
    },
  };
}

/**
 * Check if LanguageTool is properly configured
 */
export function isConfigured(): boolean {
  return isSelfHosted() || !!process.env.LANGUAGETOOL_API_KEY;
}

/**
 * Get configuration info for logging
 */
export function getConfigInfo(): string {
  if (isSelfHosted()) {
    return `Self-hosted at ${getApiUrl()}`;
  }
  if (process.env.LANGUAGETOOL_API_KEY) {
    return 'Cloud API (api.languagetool.org)';
  }
  return 'Not configured';
}
