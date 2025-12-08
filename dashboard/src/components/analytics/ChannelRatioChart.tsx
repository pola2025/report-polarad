'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface ChannelRatioChartProps {
  metaSpend: number
  naverSpend: number
  metaPercent: number
  naverPercent: number
}

const COLORS = ['#3B82F6', '#10B981'] // Meta: Blue, Naver: Green

/**
 * 채널별 비용 비중 도넛 차트
 */
export function ChannelRatioChart({ metaSpend, naverSpend, metaPercent, naverPercent }: ChannelRatioChartProps) {
  const data = [
    { name: 'Meta', value: metaSpend, percent: metaPercent },
    { name: '네이버', value: naverSpend, percent: naverPercent },
  ]

  const renderCustomLabel = (props: {
    cx?: number
    cy?: number
    midAngle?: number
    innerRadius?: number
    outerRadius?: number
    percent?: number
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            `₩${value.toLocaleString()}`,
            name,
          ]}
        />
        <Legend
          formatter={(value) => {
            const item = data.find(d => d.name === value)
            return `${value}: ₩${item?.value.toLocaleString()} (${item?.percent}%)`
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
