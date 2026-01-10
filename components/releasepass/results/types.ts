import type { ResultItem } from '@/lib/types/releasepass'

export interface CategoryGroup {
  name: string
  sortOrder: number
  items: ResultItem[]
}

export interface IgnoreToggleResult {
  resultItem: ResultItem
  urlResultScore: number
  testRunScore: number
}

export interface ResultsProps {
  resultItems: ResultItem[]
  failedItems: ResultItem[]
  passedItemsByCategory: CategoryGroup[]
  expandedItemId: string | null
  setExpandedItemId: (id: string | null) => void
  loadingItems: boolean
  onIgnoreToggle?: (itemId: string, ignored: boolean) => Promise<IgnoreToggleResult | null>
  url?: string
}
