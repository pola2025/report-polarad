'use client'

import { useState } from 'react'
import { formatNumber } from '@/lib/utils'
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { GA4SourceMedium } from '@/types/ga4-analytics'

interface TrafficTreemapProps {
  data: GA4SourceMedium[]
  metric?: 'sessions' | 'users' | 'conversions'
  height?: number
}

// 색상 팔레트 (채도 높은 순서)
const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
]

// 밝기 조절 함수
const adjustColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, Math.max(0, (num >> 16) + amt))
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt))
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt))
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`
}

// 커스텀 트리맵 콘텐츠
interface CustomContentProps {
  x: number
  y: number
  width: number
  height: number
  name: string
  value: number
  index: number
  sessions: number
  users: number
  conversions: number
  total: number
}

function CustomContent(props: CustomContentProps) {
  const { x, y, width, height, name, value, index, total } = props

  // 너무 작은 영역은 레이블 표시하지 않음
  const showLabel = width > 60 && height > 40
  const showSubLabel = width > 80 && height > 55
  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0'

  const baseColor = COLORS[index % COLORS.length]
  const fillColor = adjustColor(baseColor, -10) // 약간 어둡게

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fillColor}
        stroke="#fff"
        strokeWidth={2}
        rx={4}
        ry={4}
        style={{ cursor: 'pointer' }}
      />
      {showLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (showSubLabel ? 8 : 0)}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(14, width / 8)}
            fontWeight="600"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {name.length > 15 ? name.slice(0, 15) + '...' : name}
          </text>
          {showSubLabel && (
            <>
              <text
                x={x + width / 2}
                y={y + height / 2 + 10}
                textAnchor="middle"
                fill="#fff"
                fontSize={Math.min(12, width / 10)}
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              >
                {formatNumber(value)}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + 25}
                textAnchor="middle"
                fill="rgba(255,255,255,0.8)"
                fontSize={Math.min(11, width / 10)}
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              >
                ({percent}%)
              </text>
            </>
          )}
        </>
      )}
    </g>
  )
}

// 커스텀 툴팁
interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: { name: string; sessions: number; users: number; conversions: number; value: number; total: number } }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  const percent = data.total > 0 ? ((data.value / data.total) * 100).toFixed(1) : '0'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900 mb-2">{data.name}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">세션</span>
          <span className="font-semibold text-blue-600">{formatNumber(data.sessions)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">사용자</span>
          <span className="font-semibold text-green-600">{formatNumber(data.users)}</span>
        </div>
        {data.conversions > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">전환</span>
            <span className="font-semibold text-purple-600">{formatNumber(data.conversions)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 pt-1 border-t">
          <span className="text-gray-500">비중</span>
          <span className="font-medium text-gray-700">{percent}%</span>
        </div>
      </div>
    </div>
  )
}

export function TrafficTreemap({ data, metric = 'sessions', height = 400 }: TrafficTreemapProps) {
  const [selectedMetric, setSelectedMetric] = useState<'sessions' | 'users' | 'conversions'>(metric)

  // 데이터 변환 및 정렬
  const total = data.reduce((sum, item) => sum + item[selectedMetric], 0)

  const treemapData = data
    .filter(item => item[selectedMetric] > 0)
    .sort((a, b) => b[selectedMetric] - a[selectedMetric])
    .slice(0, 15) // 상위 15개만 표시
    .map((item, index) => ({
      name: item.sourceMedium || `${item.source} / ${item.medium}`,
      value: item[selectedMetric],
      sessions: item.sessions,
      users: item.users,
      conversions: item.conversions,
      index,
      total,
    }))

  const metricLabels = {
    sessions: '세션',
    users: '사용자',
    conversions: '전환',
  }

  return (
    <div className="space-y-4">
      {/* 메트릭 선택 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">유입 소스 비중</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['sessions', 'users', 'conversions'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedMetric === m
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {metricLabels[m]}
            </button>
          ))}
        </div>
      </div>

      {/* 트리맵 */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treemapData}
            dataKey="value"
            aspectRatio={4 / 3}
            stroke="#fff"
            content={<CustomContent x={0} y={0} width={0} height={0} name="" value={0} index={0} sessions={0} users={0} conversions={0} total={total} />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* 범례 테이블 */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">소스/매체</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">세션</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">사용자</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">비중</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {treemapData.slice(0, 5).map((item, index) => {
              const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
              return (
                <tr key={item.name} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="text-gray-900 truncate max-w-[200px]">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatNumber(item.sessions)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatNumber(item.users)}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{percent}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 간단한 도넛 차트 대안
interface TrafficDonutProps {
  data: GA4SourceMedium[]
  metric?: 'sessions' | 'users'
}

export function TrafficSourceList({ data, metric = 'sessions' }: TrafficDonutProps) {
  const total = data.reduce((sum, item) => sum + item[metric], 0)

  const sortedData = [...data]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 10)

  return (
    <div className="space-y-2">
      {sortedData.map((item, index) => {
        const value = item[metric]
        const percent = total > 0 ? (value / total) * 100 : 0
        const name = item.sourceMedium || `${item.source} / ${item.medium}`

        return (
          <div key={name} className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            ></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 truncate">{name}</span>
                <span className="text-sm font-medium text-gray-900 ml-2">{formatNumber(value)}</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                ></div>
              </div>
            </div>
            <span className="text-xs text-gray-500 w-12 text-right">{percent.toFixed(1)}%</span>
          </div>
        )
      })}
    </div>
  )
}
