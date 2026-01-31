'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PieChart, ChevronRight, Info, Users, DollarSign, Wallet } from 'lucide-react'
import type { MetaKPISummary, MetaDailyData } from '@/types/meta-analytics'
import { formatNumber } from '@/lib/utils'

interface BasBudgetGaugeProps {
  summary: MetaKPISummary
  daily: MetaDailyData[]
  monthlyBudget?: number
}

export function BasBudgetGauge({ summary, daily, monthlyBudget }: BasBudgetGaugeProps) {
  const [showCumulative, setShowCumulative] = useState(false)

  const { total_spend, total_leads, data_days, date_range } = summary

  // 월 예산 추정: 전달되면 사용, 아니면 일평균 * 31
  const dailySpend = data_days > 0 ? total_spend / data_days : 0
  const estimatedBudget = monthlyBudget || Math.round(dailySpend * 31)
  const budget = estimatedBudget > 0 ? estimatedBudget : total_spend * 1.3

  // 소진율
  const spendRate = budget > 0 ? (total_spend / budget) * 100 : 0
  const spendPercent = Math.min(spendRate, 100)

  // 남은 일수 계산
  const endDate = new Date(date_range.end)
  const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0)
  const today = new Date()
  const referenceDate = today < endDate ? today : endDate
  const remainingDays = Math.max(
    0,
    Math.ceil((lastDayOfMonth.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))
  )
  const totalMonthDays = lastDayOfMonth.getDate()

  // 프로젝션 계산
  const projectedSpend = dailySpend * totalMonthDays
  const projectedLeads = data_days > 0 ? Math.round((total_leads / data_days) * totalMonthDays) : 0
  const projectedCpl = projectedLeads > 0 ? projectedSpend / projectedLeads : 0
  const projectedSpendRate = budget > 0 ? (projectedSpend / budget) * 100 : 0

  // 누적 소진 데이터
  const cumulativeData = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = 0
    return sorted.map((d) => {
      cumulative += d.spend
      return { date: d.date, cumulative, daily: d.spend }
    })
  }, [daily])

  const maxCumulative = Math.max(projectedSpend, budget, cumulativeData[cumulativeData.length - 1]?.cumulative || 0)

  // SVG 게이지 계산
  // 반원 호: center(100,110), radius 80, 180도 호
  const radius = 80
  const cy = 110
  const circumference = Math.PI * radius // 반원 둘레 = π * r
  const dashOffset = circumference * (1 - spendPercent / 100)

  // Auto-Insight
  const insightText = (() => {
    const parts: string[] = []
    parts.push(
      `현재 소진 속도 기준 월말까지 예산의 ${projectedSpendRate.toFixed(0)}%를 사용할 것으로 예상됩니다.`
    )
    const budgetRangeMin = Math.round(budget / totalMonthDays * 0.9)
    const budgetRangeMax = Math.round(budget / totalMonthDays * 1.1)
    if (dailySpend >= budgetRangeMin && dailySpend <= budgetRangeMax) {
      parts.push(`일평균 소진 $${dailySpend.toFixed(1)}은 목표 범위($${budgetRangeMin}~$${budgetRangeMax}) 안에 있어 정상 운영 중입니다.`)
    } else if (dailySpend < budgetRangeMin) {
      parts.push(`일평균 소진 $${dailySpend.toFixed(1)}은 목표 범위 하한($${budgetRangeMin}) 미만입니다. 예산 소진이 부족할 수 있습니다.`)
    } else {
      parts.push(`일평균 소진 $${dailySpend.toFixed(1)}은 목표 범위 상한($${budgetRangeMax})을 초과합니다. 예산 초과에 주의하세요.`)
    }
    return parts.join(' ')
  })()

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <PieChart className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm lg:text-base">예산 & 프로젝션</h3>
            <p className="text-xs text-gray-400 hidden lg:block">월간 예산 소진 현황 및 월말 예측</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5">
          <span className="text-xs text-gray-500">남은</span>
          <span className="text-sm font-bold text-amber-600">D-{remainingDays}</span>
        </div>
      </div>

      {/* 데스크탑: 게이지 + 프로젝션 2열 */}
      <div className="hidden lg:grid grid-cols-2 gap-8">
        {/* SVG 반원 게이지 */}
        <div className="text-center">
          <motion.svg
            viewBox="0 0 200 120"
            className="w-full max-w-[280px] mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <defs>
              <linearGradient id="basGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            {/* 배경 호 */}
            <path
              d={`M 20 ${cy} A ${radius} ${radius} 0 0 1 180 ${cy}`}
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* 진행 호 */}
            <motion.path
              d={`M 20 ${cy} A ${radius} ${radius} 0 0 1 180 ${cy}`}
              fill="none"
              stroke="url(#basGaugeGrad)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
            {/* 눈금 */}
            <text x="16" y="118" fontSize="10" fill="#6b7280" fontWeight="600" textAnchor="start">
              $0
            </text>
            <text x="100" y="24" fontSize="11" fill="#4b5563" fontWeight="700" textAnchor="middle">
              ${formatNumber(Math.round(budget / 2))}
            </text>
            <text x="184" y="118" fontSize="10" fill="#6b7280" fontWeight="600" textAnchor="end">
              ${formatNumber(Math.round(budget))}
            </text>
          </motion.svg>
          <div className="-mt-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="text-4xl font-bold text-amber-600"
            >
              {Math.round(spendPercent)}
              <span className="text-xl">%</span>
            </motion.div>
            <div className="text-sm text-gray-500 mt-1">
              ${formatNumber(Math.round(total_spend))}{' '}
              <span className="text-gray-400">/ ${formatNumber(Math.round(budget))}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">일평균 ${dailySpend.toFixed(1)} 소진 중</div>
          </div>
        </div>

        {/* 프로젝션 카드 3개 */}
        <div className="space-y-4">
          <div className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
            월말 예상 (프로젝션)
          </div>

          {/* 예상 리드 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-blue-50 to-blue-50/50 rounded-xl p-4 border border-blue-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-blue-500">예상 리드</div>
                  <div className="text-xl font-bold text-blue-700">~{projectedLeads}건</div>
                </div>
              </div>
              {total_leads > 0 && (
                <div className="text-right">
                  <div className="text-xs text-green-600 font-medium">
                    {projectedLeads > total_leads ? '+' : ''}
                    {(((projectedLeads - total_leads) / total_leads) * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-gray-400">현재 {total_leads}건</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* 예상 CPL */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-gradient-to-r from-green-50 to-green-50/50 rounded-xl p-4 border border-green-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-green-500">예상 CPL</div>
                  <div className="text-xl font-bold text-green-700">
                    ~${projectedCpl.toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {projectedCpl <= 20 ? (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                    목표 이하
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                    목표 초과
                  </span>
                )}
                <div className="text-[10px] text-gray-400 mt-0.5">목표: $20</div>
              </div>
            </div>
          </motion.div>

          {/* 예상 지출 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-r from-purple-50 to-purple-50/50 rounded-xl p-4 border border-purple-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-xs text-purple-500">예상 지출</div>
                  <div className="text-xl font-bold text-purple-700">
                    ~${formatNumber(Math.round(projectedSpend))}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-purple-600 font-medium">
                  {projectedSpendRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-gray-400">예산 대비</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 모바일: 가로 프로그레스바 + 미니카드 */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-amber-600">{Math.round(spendPercent)}%</span>
          <span className="text-xs text-gray-400">
            ${formatNumber(Math.round(total_spend))} / ${formatNumber(Math.round(budget))}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${spendPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="bg-gradient-to-r from-amber-400 to-orange-500 h-4 rounded-full flex items-center justify-end pr-2"
          >
            <span className="text-[9px] text-white font-bold">
              ${formatNumber(Math.round(total_spend))}
            </span>
          </motion.div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-[9px] text-blue-500">예상 리드</div>
            <div className="text-sm font-bold text-blue-700">~{projectedLeads}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-[9px] text-green-500">예상 CPL</div>
            <div className="text-sm font-bold text-green-700">~${projectedCpl.toFixed(0)}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <div className="text-[9px] text-purple-500">예상 지출</div>
            <div className="text-sm font-bold text-purple-700">
              ~${projectedSpend >= 1000 ? `${(projectedSpend / 1000).toFixed(1)}K` : formatNumber(Math.round(projectedSpend))}
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Disclosure: 누적 소진 차트 */}
      {cumulativeData.length > 2 && (
        <div>
          <button
            onClick={() => setShowCumulative(!showCumulative)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-amber-600 transition-colors"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${showCumulative ? 'rotate-90' : ''}`}
            />
            일별 누적 소진 추이
            <span className="text-[10px] text-gray-400 font-normal">
              ({showCumulative ? '접기' : '펼치기'})
            </span>
          </button>

          <AnimatePresence>
            {showCumulative && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="bg-gray-50 rounded-xl p-4 mt-3">
                  <div className="flex items-end gap-[3px] h-24">
                    {cumulativeData.map((d, idx) => {
                      const heightPct = maxCumulative > 0 ? (d.cumulative / maxCumulative) * 100 : 0
                      return (
                        <motion.div
                          key={d.date}
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct}%` }}
                          transition={{ delay: idx * 0.03, duration: 0.4 }}
                          className="flex-1 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t hover:brightness-110 transition-all"
                          title={`${d.date}: $${d.cumulative.toFixed(0)} (일 $${d.daily.toFixed(0)})`}
                        />
                      )
                    })}
                    {/* 예상 바 */}
                    {remainingDays > 0 &&
                      Array.from({ length: Math.min(remainingDays, 10) }).map((_, idx) => {
                        const projCum = (cumulativeData[cumulativeData.length - 1]?.cumulative || 0) + dailySpend * (idx + 1)
                        const heightPct = maxCumulative > 0 ? (projCum / maxCumulative) * 100 : 0
                        return (
                          <div
                            key={`proj-${idx}`}
                            className="flex-1 bg-amber-200 rounded-t border-2 border-dashed border-amber-400"
                            style={{ height: `${Math.min(heightPct, 100)}%` }}
                          />
                        )
                      })}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-1">
                    <span>1일</span>
                    <span className="text-amber-600 font-bold">현재 ({data_days}일)</span>
                    <span>{totalMonthDays}일 (예상)</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 bg-amber-400 rounded" /> 실제 소진
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 bg-amber-200 border border-dashed border-amber-400 rounded" />{' '}
                      예상 소진
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Auto-Insight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 lg:p-4 border border-amber-100"
      >
        <div className="flex items-start gap-2 lg:gap-3">
          <div className="w-6 h-6 lg:w-7 lg:h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-amber-600" />
          </div>
          <div className="text-xs lg:text-sm text-amber-800">
            <span className="font-bold">Auto-Insight:</span> {insightText}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
