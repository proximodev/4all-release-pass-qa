import { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  title?: string
}

export default function Card({ children, title, className = '', ...props }: CardProps) {
  return (
    <div className={`${className}`} {...props}>
      {title && (
        <h2 className="text-xl font-heading font-bold text-black mb-4">{title}</h2>
      )}
      {children}
    </div>
  )
}
