/**
 * Validation utilities for dictionary words
 */

// Word validation rules
const MIN_LENGTH = 2;
const MAX_LENGTH = 45;

// Allowed characters: Unicode letters, numbers, hyphens, apostrophes
// Note: Spaces are NOT allowed (input with spaces is split into multiple words)
const VALID_WORD_PATTERN = /^[\p{L}\p{N}'-]+$/u;

export interface WordValidationResult {
  valid: boolean;
  word?: string;         // Lowercase for storage
  displayWord?: string;  // Original casing
  error?: string;
}

/**
 * Normalize apostrophes (curly to straight) and trim whitespace
 */
function normalizeWord(input: string): string {
  return input
    .replace(/['']/g, "'")  // Normalize curly apostrophes
    .trim();
}

/**
 * Validate a single word for dictionary entry
 */
export function validateWord(input: string): WordValidationResult {
  const displayWord = normalizeWord(input);

  if (!displayWord) {
    return { valid: false, error: 'Word cannot be empty' };
  }

  if (displayWord.includes(' ')) {
    return { valid: false, error: 'Word cannot contain spaces (split into multiple entries)' };
  }

  if (displayWord.length < MIN_LENGTH) {
    return { valid: false, error: `Word must be at least ${MIN_LENGTH} characters` };
  }

  if (displayWord.length > MAX_LENGTH) {
    return { valid: false, error: `Word cannot exceed ${MAX_LENGTH} characters` };
  }

  if (!VALID_WORD_PATTERN.test(displayWord)) {
    return { valid: false, error: 'Word contains invalid characters (allowed: letters, numbers, hyphens, apostrophes)' };
  }

  return {
    valid: true,
    word: displayWord.toLowerCase(),
    displayWord,
  };
}

/**
 * Parse input text into individual words
 * - Splits on newlines
 * - Splits on spaces within each line
 * - Normalizes apostrophes
 * - Returns array of raw words (not yet validated)
 */
export function parseWordInput(input: string): string[] {
  return input
    .split(/[\n\r]+/)              // Split on newlines
    .flatMap(line => line.split(/\s+/))  // Split on spaces
    .map(word => normalizeWord(word))
    .filter(word => word.length > 0);    // Remove empty strings
}

/**
 * Validate multiple words and categorize results
 */
export interface BulkValidationResult {
  valid: Array<{ word: string; displayWord: string }>;
  invalid: Array<{ input: string; error: string }>;
}

export function validateWords(inputs: string[]): BulkValidationResult {
  const valid: Array<{ word: string; displayWord: string }> = [];
  const invalid: Array<{ input: string; error: string }> = [];

  for (const input of inputs) {
    const result = validateWord(input);
    if (result.valid && result.word && result.displayWord) {
      valid.push({ word: result.word, displayWord: result.displayWord });
    } else {
      invalid.push({ input, error: result.error || 'Invalid word' });
    }
  }

  return { valid, invalid };
}
