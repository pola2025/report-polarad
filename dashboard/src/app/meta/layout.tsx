'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const permissions = [
  { href: '/meta/pages-show-list', name: 'pages_show_list', label: 'Pages' },
  { href: '/meta/pages-read-engagement', name: 'pages_read_engagement', label: 'Page Insights' },
  { href: '/meta/business-management', name: 'business_management', label: 'Business' },
  { href: '/meta/ads-read', name: 'ads_read', label: 'Ad Accounts' },
  { href: '/meta/ads-management', name: 'ads_management', label: 'Campaigns' },
]

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#F5A623] border-b border-[#E09000]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/meta" className="flex items-center gap-4">
              <Image
                src="/images/logo.png"
                alt="Polarad"
                width={48}
                height={48}
                className="rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold text-white">POLA-REPORT</h1>
                <p className="text-sm text-white/80">Marketing Analytics Platform</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Permission Navigation */}
      {pathname !== '/meta' && (
        <nav className="bg-white border-b shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              <Link
                href="/meta"
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md whitespace-nowrap"
              >
                ← All Permissions
              </Link>
              <span className="text-gray-300 mx-2">|</span>
              {permissions.map((perm) => {
                const isActive = pathname === perm.href
                return (
                  <Link
                    key={perm.href}
                    href={perm.href}
                    className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-[#F5A623] text-white font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {perm.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>POLA-REPORT by Polarad</p>
          <p className="mt-1">Marketing Analytics Platform</p>
        </div>
      </footer>
    </div>
  )
}
