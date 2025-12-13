'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

export default function Header() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard/qa') {
      return pathname.startsWith('/dashboard/qa')
    }
    return pathname.startsWith(path)
  }

  return (
    <header className="bg-dark-gray border-b border-charcol">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/logo.svg"
              alt="4All Digital"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          </Link>

          {/* Main Navigation */}
          <nav className="flex items-center space-x-8">
            <Link
              href="/dashboard/qa/audit"
              className={`text-white hover:text-brand-yellow transition-colors ${
                isActive('/dashboard/qa') ? 'text-brand-yellow' : ''
              }`}
            >
              QA Tools
            </Link>
            <Link
              href="/dashboard/projects"
              className={`text-white hover:text-brand-yellow transition-colors ${
                isActive('/dashboard/projects') ? 'text-brand-yellow' : ''
              }`}
            >
              Projects
            </Link>
            <Link
              href="/dashboard/utilities"
              className="text-white/50 hover:text-white/70 transition-colors cursor-not-allowed"
              aria-disabled="true"
            >
              Utilities
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard/settings"
              className="text-white hover:text-brand-yellow transition-colors"
              aria-label="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="px-4 py-2 bg-white text-black rounded hover:bg-white/90 transition-colors text-sm font-medium"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  )
}
