'use client'

import { ReactNode } from 'react'
import { Loader2, CheckCircle2, AlertCircle, Code2, Sparkles, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface DemoSectionProps {
  permission: string
  title: string
  description: string
  apiEndpoint: string
  apiFields?: string[]
  userBenefit?: string
  status: 'loading' | 'success' | 'error' | 'idle'
  error?: string | null
  children: ReactNode
}

export function DemoSection({
  permission,
  title,
  description,
  apiEndpoint,
  apiFields,
  userBenefit,
  status,
  error,
  children,
}: DemoSectionProps) {
  return (
    <div className="space-y-6">
      {/* Permission Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-white/20 rounded text-sm font-mono">
            Permission
          </span>
          {status === 'success' && (
            <span className="px-2 py-0.5 bg-green-400/30 rounded text-sm flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Granted
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold mb-2">{permission}</h1>
        <p className="text-white/80 text-lg">{title}</p>
      </div>

      {/* User Benefit - CRITICAL FOR APP REVIEW */}
      {userBenefit && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 border-2">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 rounded-full">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-800 text-lg mb-1">
                  User Experience Benefit
                </h3>
                <p className="text-emerald-700">{userBenefit}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What This Permission Does</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">{description}</p>
        </CardContent>
      </Card>

      {/* Data Flow Visualization */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium">
              Meta API
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400" />
            <div className="px-4 py-2 bg-[#F5A623] text-white rounded-lg font-medium">
              POLA-REPORT
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400" />
            <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
              User Dashboard
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Call Info */}
      <Card className="bg-gray-900 text-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            API Call
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-sm">
            <span className="text-green-400">GET</span>{' '}
            <span className="text-blue-400">{apiEndpoint}</span>
          </div>
          {apiFields && apiFields.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-gray-400 text-xs mb-2">Fields requested:</p>
              <div className="flex flex-wrap gap-1">
                {apiFields.map((field) => (
                  <span
                    key={field}
                    className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status */}
      {status === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#F5A623] mx-auto mb-4" />
            <p className="text-gray-600">Fetching data from Meta API...</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Error</h3>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Display */}
      {status === 'success' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Data Retrieved Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      )}
    </div>
  )
}

// Data display components
export function DataGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}

export function DataCard({
  label,
  value,
  subValue,
  highlight,
}: {
  label: string
  value: string | number
  subValue?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        highlight ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-xl font-bold mt-1 ${highlight ? 'text-blue-600' : 'text-gray-900'}`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subValue && <p className="text-xs text-gray-400 font-mono mt-1">{subValue}</p>}
    </div>
  )
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: (string | number | ReactNode)[][]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left font-medium text-gray-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
