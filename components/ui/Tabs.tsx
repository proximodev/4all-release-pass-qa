'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface Tab {
  label: string
  href: string
}

interface TabsProps {
  tabs: Tab[]
}

export default function Tabs({ tabs }: TabsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const projectParam = searchParams.get('project')

  const getHref = (href: string) => {
    return projectParam ? `${href}?project=${projectParam}` : href
  }

  const isActive = (href: string) => {
    return pathname === href
  }

  return (
    <div className="border-b border-medium-gray bg-white">
      <div className="flex space-x-8">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={getHref(tab.href)}
            className={`pb-4 pt-2 border-b-4 transition-colors ${
              isActive(tab.href)
                ? 'border-brand-yellow text-black font-medium'
                : 'border-transparent text-black/60 hover:text-black hover:border-black/20'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
