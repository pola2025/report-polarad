'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye,
  MousePointerClick,
  Play,
  CheckCircle2,
  ChevronRight,
  Info,
  ArrowDown,
} from 'lucide-react'
import type { MetaKPISummary, MetaAdData } from '@/types/meta-analytics'
import { formatNumber } from '@/lib/utils'

interface BasConversionFunnelProps {
  summary: MetaKPISummary
  ads: MetaAdData[]
}

interface FunnelStep {
  label: string
  value: number
  icon: typeof Eye
  bgGradient: string
  iconBg: string
  textColor: string
  labelColor: string
  secondaryLabel: string
  secondaryValue: string
}

export function BasConversionFunnel({ summary, ads }: BasConversionFunnelProps) {
  const [showCampaigns, setShowCampaigns] = useState(false)

  const {
    total_impressions,
    total_clicks,
    total_video_views,
    total_leads,
    total_spend,
  } = summary

  // 전환율 계산
  const ctr = total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0
  const vtr = total_clicks > 0 ? (total_video_views / total_clicks) * 100 : 0
  const cvr = total_clicks > 0 ? (total_leads / total_clicks) * 100 : 0
  const cpm = total_impressions > 0 ? (total_spend / total_impressions) * 1000 : 0
  const cpc = total_clicks > 0 ? total_spend / total_clicks : 0
  const cpl = total_leads > 0 ? total_spend / total_leads : 0

  // 이탈 수
  const dropImprToClick = total_impressions - total_clicks
  const dropClickToVideo = total_clicks - total_video_views
  const dropVideoToLead = total_video_views - total_leads

  // 가장 큰 이탈 구간
  const maxDropSection =
    dropImprToClick >= dropClickToVideo && dropImprToClick >= dropVideoToLead
      ? '노출→클릭'
      : dropClickToVideo >= dropVideoToLead
        ? '클릭→비디오'
        : '비디오→리드'
  const maxDropPct =
    maxDropSection === '노출→클릭'
      ? ((dropImprToClick / total_impressions) * 100).toFixed(1)
      : maxDropSection === '클릭→비디오'
        ? ((dropClickToVideo / total_clicks) * 100).toFixed(1)
        : ((dropVideoToLead / total_video_views) * 100).toFixed(1)

  // 캠페인별 전환율 (campaign_name 기준 그룹핑)
  const campaignStats = useMemo(() => {
    const grouped = new Map<string, { leads: number; clicks: number; spend: number }>()
    ads.forEach((ad) => {
      const name = ad.campaign_name || '기타'
      const prev = grouped.get(name) || { leads: 0, clicks: 0, spend: 0 }
      grouped.set(name, {
        leads: prev.leads + ad.leads,
        clicks: prev.clicks + ad.clicks,
        spend: prev.spend + ad.spend,
      })
    })
    return Array.from(grouped.entries())
      .map(([name, data]) => ({
        name,
        leads: data.leads,
        clicks: data.clicks,
        cvr: data.clicks > 0 ? (data.leads / data.clicks) * 100 : 0,
        cpl: data.leads > 0 ? data.spend / data.leads : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
  }, [ads])

  const maxCampaignLeads = Math.max(...campaignStats.map((c) => c.leads), 1)

  const steps: FunnelStep[] = [
    {
      label: '노출',
      value: total_impressions,
      icon: Eye,
      bgGradient: 'from-blue-100 via-blue-100 to-blue-50',
      iconBg: 'bg-blue-200',
      textColor: 'text-blue-800',
      labelColor: 'text-blue-500',
      secondaryLabel: 'CPM',
      secondaryValue: `$${cpm.toFixed(2)}`,
    },
    {
      label: '클릭',
      value: total_clicks,
      icon: MousePointerClick,
      bgGradient: 'from-blue-200 via-blue-200 to-blue-100',
      iconBg: 'bg-blue-300',
      textColor: 'text-blue-800',
      labelColor: 'text-blue-600',
      secondaryLabel: 'CPC',
      secondaryValue: `$${cpc.toFixed(2)}`,
    },
    {
      label: '비디오 조회',
      value: total_video_views,
      icon: Play,
      bgGradient: 'from-blue-400 via-blue-400 to-blue-300',
      iconBg: 'bg-blue-500',
      textColor: 'text-white',
      labelColor: 'text-blue-200',
      secondaryLabel: 'VTR',
      secondaryValue: `${vtr.toFixed(1)}%`,
    },
    {
      label: '리드',
      value: total_leads,
      icon: CheckCircle2,
      bgGradient: 'from-blue-700 via-blue-700 to-blue-600',
      iconBg: 'bg-blue-800',
      textColor: 'text-white',
      labelColor: 'text-blue-300',
      secondaryLabel: 'CPL',
      secondaryValue: `$${cpl.toFixed(1)}`,
    },
  ]

  const connectors = [
    { label: `CTR ${ctr.toFixed(2)}%`, dropCount: dropImprToClick, color: 'text-amber-600' },
    { label: `${vtr.toFixed(1)}%`, dropCount: dropClickToVideo, color: 'text-amber-600' },
    { label: `CVR ${cvr.toFixed(2)}%`, dropCount: dropVideoToLead, color: 'text-green-600' },
  ]

  // Auto-Insight 텍스트 생성
  const insightText = (() => {
    const parts: string[] = []
    if (ctr > 0) {
      const benchmark = 1.8
      const comparison = ctr > benchmark ? '양호' : '미달'
      parts.push(
        `노출 대비 클릭 전환율(CTR) ${ctr.toFixed(2)}%로 업종 평균(${benchmark}%) 대비 ${comparison}합니다.`
      )
    }
    if (ctr > 0 && ctr < 3) {
      const additionalLeads = Math.round((total_impressions * 0.005 * cvr) / 100)
      if (additionalLeads > 0) {
        parts.push(`CTR을 0.5%p 개선하면 월 리드 약 ${additionalLeads}건 추가 확보 가능합니다.`)
      }
    }
    parts.push(`현재 가장 큰 이탈 구간은 ${maxDropSection}(${maxDropPct}% 이탈)입니다.`)
    return parts.join(' ')
  })()

  // 펀넬 단계별 인덱싱 (px 줄이기)
  const paddings = ['px-0', 'px-4 lg:px-8', 'px-8 lg:px-16', 'px-12 lg:px-24']

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ArrowDown className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm lg:text-base">전환 퍼널</h3>
            <p className="text-xs text-gray-400 hidden lg:block">노출에서 리드까지의 전환 흐름</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">총 지출</span>
          <span className="text-base lg:text-lg font-bold text-gray-900">
            ${formatNumber(Math.round(total_spend))}
          </span>
        </div>
      </div>

      {/* 퍼널 본체 - 데스크탑 */}
      <div className="space-y-1 hidden lg:block">
        {steps.map((step, idx) => (
          <div key={step.label}>
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.15, duration: 0.5, ease: 'easeOut' }}
              className={paddings[idx]}
            >
              <div
                className={`bg-gradient-to-r ${step.bgGradient} rounded-xl py-4 px-5 flex items-center justify-between ${
                  idx === 3 ? 'shadow-lg shadow-blue-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 ${step.iconBg} rounded-lg flex items-center justify-center`}>
                    <step.icon className={`w-4 h-4 ${idx >= 2 ? 'text-white' : 'text-blue-600'}`} />
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
                <div className="text-right">
                  <div className={`text-xs ${idx >= 2 ? 'text-blue-200' : 'text-blue-400'}`}>
                    {step.secondaryLabel}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      idx === 3 ? 'text-amber-300 text-lg font-bold' : step.textColor
                    }`}
                  >
                    {step.secondaryValue}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 전환율 커넥터 */}
            {idx < 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.15 + 0.2 }}
                className="flex items-center justify-center py-1"
              >
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                  <ArrowDown className="w-3 h-3 text-gray-400" />
                  <span className={`text-xs font-bold ${connectors[idx].color}`}>
                    {connectors[idx].label}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    ({formatNumber(connectors[idx].dropCount)} 이탈)
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* 퍼널 본체 - 모바일 */}
      <div className="space-y-1.5 lg:hidden">
        {steps.map((step, idx) => (
          <div key={`m-${step.label}`}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.12, duration: 0.4 }}
              style={{ marginLeft: `${idx * 12}px`, marginRight: `${idx * 12}px` }}
            >
              <div
                className={`bg-gradient-to-r ${step.bgGradient} rounded-lg py-2.5 px-3 flex items-center justify-between ${
                  idx === 3 ? 'shadow-lg shadow-blue-500/20' : ''
                }`}
              >
                <span className={`text-xs font-medium ${step.labelColor}`}>{step.label}</span>
                <span className={`text-sm font-bold ${step.textColor}`}>
                  {step.value >= 1000 ? `${(step.value / 1000).toFixed(step.value >= 10000 ? 0 : 1)}K` : formatNumber(step.value)}
                </span>
              </div>
            </motion.div>

            {idx < 3 && (
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
        transition={{ delay: 0.8, duration: 0.5 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 lg:p-4 border border-blue-100"
      >
        <div className="flex items-start gap-2 lg:gap-3">
          <div className="w-6 h-6 lg:w-7 lg:h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
          </div>
          <div className="text-xs lg:text-sm text-blue-800">
            <span className="font-bold">Auto-Insight:</span> {insightText}
          </div>
        </div>
      </motion.div>

      {/* Progressive Disclosure: 캠페인별 비교 */}
      {campaignStats.length > 1 && (
        <div>
          <button
            onClick={() => setShowCampaigns(!showCampaigns)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-amber-600 transition-colors"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${showCampaigns ? 'rotate-90' : ''}`}
            />
            캠페인별 전환율 비교
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
                  {campaignStats.map((campaign, idx) => {
                    const barWidth = Math.round((campaign.leads / maxCampaignLeads) * 100)
                    const cvrColor =
                      campaign.cvr >= 4
                        ? 'text-green-600'
                        : campaign.cvr >= 2
                          ? 'text-amber-600'
                          : 'text-red-500'
                    const barColor =
                      campaign.cvr >= 4
                        ? 'from-green-400 to-green-500'
                        : campaign.cvr >= 2
                          ? 'from-amber-400 to-amber-500'
                          : 'from-red-400 to-red-500'

                    return (
                      <motion.div
                        key={campaign.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 truncate max-w-[60%]">
                            {campaign.name}
                          </span>
                          <span className={`font-bold ${cvrColor}`}>
                            CVR {campaign.cvr.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: idx * 0.1 + 0.2, duration: 0.6 }}
                            className={`bg-gradient-to-r ${barColor} h-3 rounded-full flex items-center justify-end pr-2 origin-left`}
                            style={{ width: `${Math.max(barWidth, 15)}%` }}
                          >
                            <span className="text-[9px] text-white font-bold">
                              {campaign.leads}건
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

