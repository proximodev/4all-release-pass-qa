import { ReactNode } from 'react'

interface TabPanelProps {
  children: ReactNode
  className?: string
}

export default function TabPanel({ children, className = '' }: TabPanelProps) {
  return (
    <div className={'bg-gray-50 p-8'}>
        {children}
    </div>
  )
}
