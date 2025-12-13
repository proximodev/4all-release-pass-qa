import { ReactNode } from 'react'

interface TwoColumnGridProps {
  children: ReactNode
  className?: string
}

export default function TwoColumnGrid({ children, className = '' }: TwoColumnGridProps) {
  return (
    <div className={'bg-gray-50 p-8'}>
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`.trim()}>
        {children}
      </div>
    </div>
  )
}
