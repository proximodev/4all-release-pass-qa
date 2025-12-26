'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import styles from './Tabs.module.css'

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
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className={styles.container}>
      {tabs.map((tab) => {
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={getHref(tab.href)}
            className={`${styles.tabLink} ${active ? styles.tabLinkActive : styles.tabLinkInactive}`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
