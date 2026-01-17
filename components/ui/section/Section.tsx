import { ReactNode, HTMLAttributes } from 'react'

interface SectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  title?: string
}

export default function Section({ children, title, className = '', ...props }: SectionProps) {
  return (
    <div className={`${className}`} {...props}>
      {title && (
        <h3>{title}</h3>
      )}
      {children}
    </div>
  )
}
