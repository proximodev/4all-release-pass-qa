import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  action?: ReactNode
  className?: string
}

export default function PageHeader({ title, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`.trim()}>
      <h2>{title}</h2>
      {action && <div>{action}</div>}
    </div>
  )
}
