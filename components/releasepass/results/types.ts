import type { ResultItem } from '@/lib/types/releasepass'

export interface CategoryGroup {
  name: string
  sortOrder: number
  items: ResultItem[]
}

export interface ResultsProps {
  resultItems: ResultItem[]
  failedItems: ResultItem[]
  passedItemsByCategory: CategoryGroup[]
  expandedItemId: string | null
  setExpandedItemId: (id: string | null) => void
  loadingItems: boolean
}
