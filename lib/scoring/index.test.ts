import { describe, it, expect } from 'vitest'
import {
  isPassingScore,
  getScoreStatus,
  getScoreColor,
  getScoreBadgeClasses,
  getStatusBadgeClasses,
  calculateScoreFromItems,
  calculateReleaseScore,
  getSeveritySortOrder,
  SCORING_CONFIG,
} from './index'

describe('Scoring Configuration', () => {
  it('should have expected threshold values', () => {
    expect(SCORING_CONFIG.passThreshold).toBe(70)
    expect(SCORING_CONFIG.colorThresholds.green).toBe(90)
    expect(SCORING_CONFIG.colorThresholds.yellow).toBe(70)
  })

  it('should have expected severity penalties', () => {
    expect(SCORING_CONFIG.severityPenalties.INFO).toBe(0)
    expect(SCORING_CONFIG.severityPenalties.LOW).toBe(2)
    expect(SCORING_CONFIG.severityPenalties.MEDIUM).toBe(5)
    expect(SCORING_CONFIG.severityPenalties.HIGH).toBe(10)
    expect(SCORING_CONFIG.severityPenalties.CRITICAL).toBe(20)
    expect(SCORING_CONFIG.severityPenalties.BLOCKER).toBe(40)
  })
})

describe('isPassingScore', () => {
  it('should return true for scores at or above threshold', () => {
    expect(isPassingScore(70)).toBe(true)
    expect(isPassingScore(71)).toBe(true)
    expect(isPassingScore(100)).toBe(true)
  })

  it('should return false for scores below threshold', () => {
    expect(isPassingScore(69)).toBe(false)
    expect(isPassingScore(50)).toBe(false)
    expect(isPassingScore(0)).toBe(false)
  })
})

describe('getScoreStatus', () => {
  it('should return PASS for passing scores', () => {
    expect(getScoreStatus(70)).toBe('PASS')
    expect(getScoreStatus(100)).toBe('PASS')
  })

  it('should return FAIL for failing scores', () => {
    expect(getScoreStatus(69)).toBe('FAIL')
    expect(getScoreStatus(0)).toBe('FAIL')
  })
})

describe('getScoreColor', () => {
  it('should return green for scores >= 90', () => {
    expect(getScoreColor(90)).toBe('green')
    expect(getScoreColor(95)).toBe('green')
    expect(getScoreColor(100)).toBe('green')
  })

  it('should return yellow for scores >= 70 and < 90', () => {
    expect(getScoreColor(70)).toBe('yellow')
    expect(getScoreColor(80)).toBe('yellow')
    expect(getScoreColor(89)).toBe('yellow')
  })

  it('should return red for scores < 70', () => {
    expect(getScoreColor(69)).toBe('red')
    expect(getScoreColor(50)).toBe('red')
    expect(getScoreColor(0)).toBe('red')
  })
})

describe('getScoreBadgeClasses', () => {
  it('should return correct classes for green scores', () => {
    expect(getScoreBadgeClasses(100)).toBe('bg-score-green text-white')
  })

  it('should return correct classes for yellow scores', () => {
    expect(getScoreBadgeClasses(80)).toBe('bg-score-yellow text-black')
  })

  it('should return correct classes for red scores', () => {
    expect(getScoreBadgeClasses(50)).toBe('bg-score-red text-white')
  })
})

describe('getStatusBadgeClasses', () => {
  it('should return correct classes for pass status', () => {
    expect(getStatusBadgeClasses('pass')).toBe('bg-score-green text-white')
  })

  it('should return correct classes for fail status', () => {
    expect(getStatusBadgeClasses('fail')).toBe('bg-score-red text-white')
  })
})

describe('getSeveritySortOrder', () => {
  it('should return lower numbers for higher severity', () => {
    const blockerOrder = getSeveritySortOrder('BLOCKER')
    const criticalOrder = getSeveritySortOrder('CRITICAL')
    const highOrder = getSeveritySortOrder('HIGH')
    const mediumOrder = getSeveritySortOrder('MEDIUM')
    const lowOrder = getSeveritySortOrder('LOW')
    const infoOrder = getSeveritySortOrder('INFO')

    expect(blockerOrder).toBeLessThan(criticalOrder)
    expect(criticalOrder).toBeLessThan(highOrder)
    expect(highOrder).toBeLessThan(mediumOrder)
    expect(mediumOrder).toBeLessThan(lowOrder)
    expect(lowOrder).toBeLessThan(infoOrder)
  })

  it('should handle case insensitivity', () => {
    expect(getSeveritySortOrder('blocker')).toBe(getSeveritySortOrder('BLOCKER'))
    expect(getSeveritySortOrder('Critical')).toBe(getSeveritySortOrder('CRITICAL'))
  })

  it('should return 999 for unknown severity', () => {
    expect(getSeveritySortOrder('UNKNOWN')).toBe(999)
    expect(getSeveritySortOrder(null)).toBe(999)
    expect(getSeveritySortOrder(undefined)).toBe(999)
  })
})

describe('calculateScoreFromItems', () => {
  it('should return 100 for all passing items', () => {
    const items = [
      { status: 'PASS', severity: 'HIGH' },
      { status: 'PASS', severity: 'MEDIUM' },
    ]
    expect(calculateScoreFromItems(items)).toBe(100)
  })

  it('should return 100 for empty items array', () => {
    expect(calculateScoreFromItems([])).toBe(100)
  })

  it('should deduct penalties for failed items', () => {
    const items = [
      { status: 'FAIL', severity: 'HIGH' }, // -10
    ]
    expect(calculateScoreFromItems(items)).toBe(90)
  })

  it('should deduct correct penalties for each severity', () => {
    expect(calculateScoreFromItems([{ status: 'FAIL', severity: 'BLOCKER' }])).toBe(60)
    expect(calculateScoreFromItems([{ status: 'FAIL', severity: 'CRITICAL' }])).toBe(80)
    expect(calculateScoreFromItems([{ status: 'FAIL', severity: 'HIGH' }])).toBe(90)
    expect(calculateScoreFromItems([{ status: 'FAIL', severity: 'MEDIUM' }])).toBe(95)
    expect(calculateScoreFromItems([{ status: 'FAIL', severity: 'LOW' }])).toBe(98)
    expect(calculateScoreFromItems([{ status: 'FAIL', severity: 'INFO' }])).toBe(100)
  })

  it('should accumulate penalties from multiple failed items', () => {
    const items = [
      { status: 'FAIL', severity: 'HIGH' },    // -10
      { status: 'FAIL', severity: 'MEDIUM' },  // -5
      { status: 'FAIL', severity: 'LOW' },     // -2
    ]
    expect(calculateScoreFromItems(items)).toBe(83)
  })

  it('should ignore items with ignored flag', () => {
    const items = [
      { status: 'FAIL', severity: 'BLOCKER', ignored: true },
      { status: 'FAIL', severity: 'HIGH' }, // -10
    ]
    expect(calculateScoreFromItems(items)).toBe(90)
  })

  it('should skip items without severity', () => {
    const items = [
      { status: 'FAIL' }, // no severity, should be skipped
      { status: 'FAIL', severity: 'LOW' }, // -2
    ]
    expect(calculateScoreFromItems(items)).toBe(98)
  })

  it('should not go below 0', () => {
    const items = [
      { status: 'FAIL', severity: 'BLOCKER' }, // -40
      { status: 'FAIL', severity: 'BLOCKER' }, // -40
      { status: 'FAIL', severity: 'BLOCKER' }, // -40 = -120 total
    ]
    expect(calculateScoreFromItems(items)).toBe(0)
  })

  it('should handle mixed pass and fail items', () => {
    const items = [
      { status: 'PASS', severity: 'BLOCKER' },
      { status: 'FAIL', severity: 'HIGH' },    // -10
      { status: 'SKIP', severity: 'MEDIUM' },
      { status: 'FAIL', severity: 'LOW' },     // -2
    ]
    expect(calculateScoreFromItems(items)).toBe(88)
  })
})

describe('calculateReleaseScore', () => {
  it('should return null when no scored tests completed', () => {
    const result = calculateReleaseScore([], ['PAGE_PREFLIGHT', 'PERFORMANCE'])

    expect(result.score).toBeNull()
    expect(result.status).toBeNull()
    expect(result.completedTests).toBe(0)
    expect(result.totalScoredTests).toBe(2)
  })

  it('should calculate average from completed scored tests', () => {
    const testRuns = [
      { type: 'PAGE_PREFLIGHT', status: 'SUCCESS', score: 80 },
      { type: 'PERFORMANCE', status: 'SUCCESS', score: 90 },
    ]
    const result = calculateReleaseScore(testRuns, ['PAGE_PREFLIGHT', 'PERFORMANCE'])

    expect(result.score).toBe(85) // (80 + 90) / 2
    expect(result.status).toBe('Pass')
    expect(result.completedTests).toBe(2)
    expect(result.totalScoredTests).toBe(2)
  })

  it('should return Fail status when average below threshold', () => {
    const testRuns = [
      { type: 'PAGE_PREFLIGHT', status: 'SUCCESS', score: 50 },
      { type: 'PERFORMANCE', status: 'SUCCESS', score: 60 },
    ]
    const result = calculateReleaseScore(testRuns, ['PAGE_PREFLIGHT', 'PERFORMANCE'])

    expect(result.score).toBe(55)
    expect(result.status).toBe('Fail')
  })

  it('should return Incomplete when any test has FAILED status', () => {
    const testRuns = [
      { type: 'PAGE_PREFLIGHT', status: 'SUCCESS', score: 90 },
      { type: 'PERFORMANCE', status: 'FAILED', score: null },
    ]
    const result = calculateReleaseScore(testRuns, ['PAGE_PREFLIGHT', 'PERFORMANCE'])

    expect(result.score).toBeNull()
    expect(result.status).toBe('Incomplete')
    expect(result.failedTests).toBe(1)
  })

  it('should exclude SCREENSHOTS from scored tests', () => {
    const testRuns = [
      { type: 'PAGE_PREFLIGHT', status: 'SUCCESS', score: 80 },
      { type: 'SCREENSHOTS', status: 'SUCCESS', score: 100 },
    ]
    const result = calculateReleaseScore(testRuns, ['PAGE_PREFLIGHT', 'SCREENSHOTS'])

    expect(result.score).toBe(80) // Only PAGE_PREFLIGHT counted
    expect(result.totalScoredTests).toBe(1) // SCREENSHOTS not counted
  })

  it('should use selectedTests for totalScoredTests count only', () => {
    const testRuns = [
      { type: 'PAGE_PREFLIGHT', status: 'SUCCESS', score: 80 },
      { type: 'PERFORMANCE', status: 'SUCCESS', score: 100 },
    ]
    // Only PAGE_PREFLIGHT selected - but both completed tests contribute to score
    const result = calculateReleaseScore(testRuns, ['PAGE_PREFLIGHT'])

    expect(result.score).toBe(90) // Average of both completed tests
    expect(result.completedTests).toBe(2) // Both scored tests completed
    expect(result.totalScoredTests).toBe(1) // Only selected count for denominator
  })

  it('should handle SPELLING as a scored test', () => {
    const testRuns = [
      { type: 'SPELLING', status: 'SUCCESS', score: 95 },
    ]
    const result = calculateReleaseScore(testRuns, ['SPELLING'])

    expect(result.score).toBe(95)
    expect(result.status).toBe('Pass')
  })

  it('should ignore tests with null scores', () => {
    const testRuns = [
      { type: 'PAGE_PREFLIGHT', status: 'SUCCESS', score: 80 },
      { type: 'PERFORMANCE', status: 'SUCCESS', score: null },
    ]
    const result = calculateReleaseScore(testRuns, ['PAGE_PREFLIGHT', 'PERFORMANCE'])

    expect(result.score).toBe(80) // Only PAGE_PREFLIGHT counted
    expect(result.completedTests).toBe(1)
  })
})
