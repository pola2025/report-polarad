'use client'

import { Lock } from 'lucide-react'

export default function StaffPortalPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">나라똔 담당자 포털</h1>
        <p className="text-sm text-gray-500 mb-4">
          개인 링크로 접속해주세요.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            관리자에게 전달받은 개인 포털 링크<br />
            <code className="text-indigo-600">/leads/staff/[이니셜]</code> 로 접속하세요.
          </p>
        </div>
      </div>
    </div>
  )
}
