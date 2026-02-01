'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap,
  Inbox,
  Phone,
  PhoneOff,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react'
import type { BasLeadSummary } from '@/types/bas-leads'
import { formatNumber } from '@/lib/utils'

export function BasEnrollmentFunnel() {
  const [summary, setSummary] = useState<BasLeadSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCampaigns, setShowCampaigns] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/bas/leads/stats')
        if (!res.ok) throw new Error('Failed')
        const data: BasLeadSummary = await res.json()
        setSummary(data)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (!summary || summary.total === 0) return null

  const { by_status, conversion_rate, total, by_campaign } = summary

  const contacted = by_status['통화완료'] + by_status['수강등록']
  const contactRate = total > 0 ? ((contacted / total) * 100) : 0
  const enrollFromContact = contacted > 0 ? ((by_status['수강등록'] / contacted) * 100) : 0

  // 퍼널 단계 정의
  const steps = [
    {
      label: '접수',
      value: total,
      icon: Inbox,
      bg: 'from-sky-100 to-sky-50',
      iconBg: 'bg-sky-200',
      textColor: 'text-sky-800',
      labelColor: 'text-sky-500',
    },
    {
      label: '통화완료',
      value: contacted,
      icon: Phone,
      bg: 'from-emerald-100 to-emerald-50',
      iconBg: 'bg-emerald-200',
      textColor: 'text-emerald-800',
      labelColor: 'text-emerald-500',
    },
    {
      label: '수강등록',
      value: by_status['수강등록'],
      icon: CheckCircle2,
      bg: 'from-green-500 to-green-400',
      iconBg: 'bg-green-600',
      textColor: 'text-white',
      labelColor: 'text-green-200',
    },
  ]

  const connectors = [
    { label: `통화율 ${contactRate.toFixed(1)}%`, color: 'text-amber-600' },
    { label: `등록율 ${enrollFromContact.toFixed(1)}%`, color: 'text-green-600' },
  ]

  // 캠페인별 정렬: 수강등록 건수 기준
  const topCampaigns = by_campaign
    .filter(c => c.total >= 3)
    .sort((a, b) => b.by_status['수강등록'] - a.by_status['수강등록'])
    .slice(0, 8)

  const maxCampaignTotal = Math.max(...topCampaigns.map(c => c.total), 1)

  // 인사이트
  const bestCampaign = topCampaigns.find(c => c.conversion_rate > 0)
  const insightText = (() => {
    const parts: string[] = []
    parts.push(
      `전체 접수 ${formatNumber(total)}건 중 ${formatNumber(by_status['수강등록'])}건 수강등록 (전환율 ${conversion_rate}%).`
    )
    if (by_status['부재'] > 0) {
      const absentRate = ((by_status['부재'] / total) * 100).toFixed(1)
      parts.push(`부재 ${formatNumber(by_status['부재'])}건(${absentRate}%)으로 재연락 필요.`)
    }
    if (bestCampaign) {
      parts.push(`최고 전환 캠페인: ${bestCampaign.campaign} (${bestCampaign.conversion_rate}%).`)
    }
    return parts.join(' ')
  })()

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
            <GraduationCap className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm lg:text-base">수강 전환 퍼널</h3>
            <p className="text-xs text-gray-400 hidden lg:block">접수에서 수강등록까지의 전환 흐름</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">전체 전환율</span>
          <span className="text-base lg:text-lg font-bold text-green-600">
            {conversion_rate}%
          </span>
        </div>
      </div>

      {/* 퍼널 - 데스크탑 */}
      <div className="hidden lg:block space-y-1">
        {steps.map((step, idx) => (
          <div key={step.label}>
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.15, duration: 0.5, ease: 'easeOut' }}
              style={{ paddingLeft: `${idx * 32}px`, paddingRight: `${idx * 32}px` }}
            >
              <div
                className={`bg-gradient-to-r ${step.bg} rounded-xl py-4 px-5 flex items-center justify-between ${
                  idx === 2 ? 'shadow-lg shadow-green-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 ${step.iconBg} rounded-lg flex items-center justify-center`}>
                    <step.icon className={`w-4 h-4 ${idx >= 2 ? 'text-white' : 'text-gray-700'}`} />
                  </div>
                  <div>
                    <div className={`text-xs font-medium ${step.labelColor}`}>{step.label}</div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.15 + 0.3, duration: 0.4 }}
                      className={`text-xl font-bold ${step.textColor}`}
                    >
                      {formatNumber(step.value)}
                    </motion.div>
                  </div>
                </div>
                {/* 부재 표시 (접수 행에) */}
                {idx === 0 && by_status['부재'] > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-3 py-1.5">
                    <PhoneOff className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs text-gray-500">부재</span>
                    <span className="text-sm font-bold text-gray-700">{formatNumber(by_status['부재'])}</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* 커넥터 */}
            {idx < 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.15 + 0.2 }}
                className="flex items-center justify-center py-1"
              >
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className={`text-xs font-bold ${connectors[idx].color}`}>
                    {connectors[idx].label}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* 퍼널 - 모바일 */}
      <div className="lg:hidden space-y-1.5">
        {steps.map((step, idx) => (
          <div key={`m-${step.label}`}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.12, duration: 0.4 }}
              style={{ marginLeft: `${idx * 12}px`, marginRight: `${idx * 12}px` }}
            >
              <div
                className={`bg-gradient-to-r ${step.bg} rounded-lg py-2.5 px-3 flex items-center justify-between ${
                  idx === 2 ? 'shadow-lg shadow-green-500/20' : ''
                }`}
              >
                <span className={`text-xs font-medium ${step.labelColor}`}>{step.label}</span>
                <div className="flex items-center gap-2">
                  {idx === 0 && by_status['부재'] > 0 && (
                    <span className="text-[10px] text-gray-400">부재 {by_status['부재']}</span>
                  )}
                  <span className={`text-sm font-bold ${step.textColor}`}>
                    {formatNumber(step.value)}
                  </span>
                </div>
              </div>
            </motion.div>

            {idx < 2 && (
              <div className="flex items-center justify-center py-0.5">
                <span className={`text-[10px] font-bold ${connectors[idx].color} bg-gray-50 px-2 py-0.5 rounded-full`}>
                  {connectors[idx].label}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Auto-Insight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 lg:p-4 border border-green-100"
      >
        <div className="flex items-start gap-2 lg:gap-3">
          <div className="w-6 h-6 lg:w-7 lg:h-7 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-green-600" />
          </div>
          <div className="text-xs lg:text-sm text-green-800">
            <span className="font-bold">Auto-Insight:</span> {insightText}
          </div>
        </div>
      </motion.div>

      {/* 캠페인별 전환율 */}
      {topCampaigns.length > 1 && (
        <div>
          <button
            onClick={() => setShowCampaigns(!showCampaigns)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-green-600 transition-colors"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${showCampaigns ? 'rotate-90' : ''}`}
            />
            캠페인별 수강 전환율
            <span className="text-[10px] text-gray-400 font-normal">
              ({showCampaigns ? '접기' : '펼치기'})
            </span>
          </button>

          <AnimatePresence>
            {showCampaigns && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-3 bg-gray-50 rounded-xl p-4 mt-3">
                  {topCampaigns.map((campaign, idx) => {
                    const barWidth = Math.round((campaign.total / maxCampaignTotal) * 100)
                    const cvrColor =
                      campaign.conversion_rate >= 10
                        ? 'text-green-600'
                        : campaign.conversion_rate >= 5
                          ? 'text-amber-600'
                          : 'text-red-500'
                    const barColor =
                      campaign.conversion_rate >= 10
                        ? 'from-green-400 to-green-500'
                        : campaign.conversion_rate >= 5
                          ? 'from-amber-400 to-amber-500'
                          : 'from-red-400 to-red-500'

                    return (
                      <motion.div
                        key={campaign.campaign}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08 }}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 truncate max-w-[50%]">
                            {campaign.campaign}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">
                              등록 {campaign.by_status['수강등록']}건 / {campaign.total}건
                            </span>
                            <span className={`font-bold ${cvrColor}`}>
                              {campaign.conversion_rate}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: idx * 0.08 + 0.2, duration: 0.6 }}
                            className={`bg-gradient-to-r ${barColor} h-3 rounded-full flex items-center justify-end pr-2 origin-left`}
                            style={{ width: `${Math.max(barWidth, 15)}%` }}
                          >
                            <span className="text-[9px] text-white font-bold">
                              {campaign.total}건
                            </span>
                          </motion.div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
