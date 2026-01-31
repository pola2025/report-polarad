'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { MetaKPISummary, MetaDailyData, MetaAdData } from '@/types/meta-analytics'

interface BasExportData {
  summary: MetaKPISummary
  daily: MetaDailyData[]
  ads: MetaAdData[]
  dateRange: {
    start: string
    end: string
  }
}

interface BasExportButtonProps {
  data: BasExportData
  disabled?: boolean
}

export function BasExportButton({ data, disabled = false }: BasExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (disabled || exporting) return
    setExporting(true)
    try {
      // CSV 형식으로 내보내기
      const csvRows: string[] = []

      // 요약 섹션
      csvRows.push('=== BAS 광고 성과 요약 ===')
      csvRows.push(`기간,${data.dateRange.start} ~ ${data.dateRange.end}`)
      csvRows.push(`총 리드,${data.summary.total_leads}`)
      csvRows.push(`총 지출,$${data.summary.total_spend.toFixed(2)}`)
      csvRows.push(`평균 CPL,$${data.summary.avg_cpl.toFixed(2)}`)
      csvRows.push(`평균 CTR,${data.summary.avg_ctr.toFixed(2)}%`)
      csvRows.push(`총 노출,${data.summary.total_impressions}`)
      csvRows.push(`총 클릭,${data.summary.total_clicks}`)
      csvRows.push('')

      // 일별 데이터
      csvRows.push('=== 일별 데이터 ===')
      csvRows.push('날짜,노출수,클릭수,CTR(%),지출($),리드수,CPL($)')
      for (const d of data.daily) {
        csvRows.push(`${d.date},${d.impressions},${d.clicks},${d.ctr.toFixed(2)},${d.spend.toFixed(2)},${d.leads},${d.cpl.toFixed(2)}`)
      }
      csvRows.push('')

      // 광고별 데이터
      csvRows.push('=== 광고별 데이터 ===')
      csvRows.push('광고명,캠페인,노출수,클릭수,CTR(%),지출($),리드수,CPL($),운영일수')
      for (const ad of data.ads) {
        csvRows.push(`"${ad.ad_name}","${ad.campaign_name || '-'}",${ad.impressions},${ad.clicks},${ad.ctr.toFixed(2)},${ad.spend.toFixed(2)},${ad.leads},${ad.cpl.toFixed(2)},${ad.days_count}`)
      }

      // BOM 추가 (엑셀 한글 호환)
      const bom = '\uFEFF'
      const csvContent = bom + csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bas-meta-ads-report-${data.dateRange.start}-${data.dateRange.end}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={disabled || exporting}
      className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      {exporting ? '내보내는 중...' : 'CSV 내보내기'}
    </button>
  )
}
