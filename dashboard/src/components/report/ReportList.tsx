'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, FileText, Calendar, ChevronRight } from 'lucide-react'

interface Report {
  id: string
  report_type: 'monthly' | 'weekly'
  period_start: string
  period_end: string
  year: number
  month?: number
  week?: number
  status: 'draft' | 'published' | 'archived'
  published_at?: string
  label: string
  url: string
}

interface ReportListProps {
  clientSlug: string
  isAdmin?: boolean
}

export function ReportList({ clientSlug, isAdmin = false }: ReportListProps) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'monthly' | 'weekly'>('all')

  useEffect(() => {
    async function fetchReports() {
      if (!clientSlug) return

      setLoading(true)
      try {
        const params = new URLSearchParams({ clientSlug })
        if (filter !== 'all') {
          params.append('type', filter)
        }

        // 관리자와 클라이언트 모두 같은 API 사용 (clientSlug 기반)
        const url = `/api/reports?${params}`

        const headers: Record<string, string> = {}
        if (isAdmin) {
          const adminKey = localStorage.getItem('polarad_admin_key')
          if (adminKey) {
            headers['x-admin-key'] = adminKey
          }
        }

        const res = await fetch(url, { headers })
        const json = await res.json()

        if (json.success) {
          // 관리자 API는 다른 형식으로 응답
          const reportData = isAdmin ? json.reports : json.reports
          setReports(reportData || [])
          setError(null)
        } else {
          setError(json.error || '리포트를 불러올 수 없습니다.')
        }
      } catch {
        setError('네트워크 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [clientSlug, filter, isAdmin])

  // 필터링된 리포트
  const filteredReports = filter === 'all'
    ? reports
    : reports.filter(r => r.report_type === filter)

  // 리포트 라벨 생성
  const getReportLabel = (report: Report) => {
    if (report.label) return report.label
    if (report.report_type === 'monthly') {
      return `${report.year}년 ${report.month}월 리포트`
    }
    return `${report.year}년 ${report.week}주차 리포트`
  }

  // 상태 뱃지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">발행됨</span>
      case 'draft':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">초안</span>
      case 'archived':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">보관됨</span>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5A623]" />
        <span className="ml-2 text-gray-600">리포트 목록을 불러오는 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">리포트 목록</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('monthly')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            월간
          </button>
          <button
            onClick={() => setFilter('weekly')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === 'weekly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            주간
          </button>
        </div>
      </div>

      {/* 리포트 목록 */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter === 'all' ? '등록된 리포트가 없습니다.' : `${filter === 'monthly' ? '월간' : '주간'} 리포트가 없습니다.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <Link
              key={report.id}
              href={report.url || `/report/${report.report_type}/${report.id}`}
              className="block"
            >
              <Card className="hover:border-[#F5A623] hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        report.report_type === 'monthly'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-purple-100 text-purple-600'
                      }`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {getReportLabel(report)}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            report.report_type === 'monthly'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-purple-50 text-purple-600'
                          }`}>
                            {report.report_type === 'monthly' ? '월간' : '주간'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {report.period_start} ~ {report.period_end}
                          </span>
                          {getStatusBadge(report.status)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
