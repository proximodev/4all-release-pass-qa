import { ReactNode } from 'react'

interface FormContainerProps {
  children: ReactNode
  className?: string
}

export default function FormContainer({ children, className = '' }: FormContainerProps) {
  return (
    <div className={`max-w-2xl ${className}`.trim()}>
      {children}
    </div>
  )
}
