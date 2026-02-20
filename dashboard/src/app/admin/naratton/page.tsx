'use client'

import { NarattonLeadManagement } from '@/components/naratton/NarattonLeadManagement'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NarattonLeadManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            관리자
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">나라똔 리드관리</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <NarattonLeadManagement clientSlug="naratton" />
      </main>
    </div>
  )
}
