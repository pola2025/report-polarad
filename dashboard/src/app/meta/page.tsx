'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Loader2,
  FileText,
  TrendingUp,
  Building2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
} from 'lucide-react'

interface PermissionStatus {
  user: boolean
  pages: boolean
  pageInsights: boolean
  businesses: boolean
  adAccounts: boolean
}

const permissions = [
  {
    href: '/meta/pages-show-list',
    permission: 'pages_show_list',
    title: 'Facebook Pages',
    description: 'List of Pages you manage',
    icon: FileText,
    key: 'pages' as const,
    color: 'blue',
  },
  {
    href: '/meta/pages-read-engagement',
    permission: 'pages_read_engagement',
    title: 'Page Insights',
    description: 'Page engagement metrics and analytics',
    icon: TrendingUp,
    key: 'pageInsights' as const,
    color: 'green',
  },
  {
    href: '/meta/business-management',
    permission: 'business_management',
    title: 'Business Accounts',
    description: 'Business Manager information',
    icon: Building2,
    key: 'businesses' as const,
    color: 'purple',
  },
  {
    href: '/meta/ads-read',
    permission: 'ads_read',
    title: 'Ad Accounts',
    description: 'Ad account data and metrics',
    icon: BarChart3,
    key: 'adAccounts' as const,
    color: 'orange',
  },
]

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600 border-blue-200',
  green: 'bg-green-100 text-green-600 border-green-200',
  purple: 'bg-purple-100 text-purple-600 border-purple-200',
  orange: 'bg-orange-100 text-orange-600 border-orange-200',
}

export default function DemoIndexPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<PermissionStatus>({
    user: false,
    pages: false,
    pageInsights: false,
    businesses: false,
    adAccounts: false,
  })
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    async function checkPermissions() {
      try {
        const res = await fetch('/api/meta?action=all')
        const json = await res.json()
        if (json.success) {
          const data = json.data
          setStatus({
            user: !!data.user,
            pages: data.pages && data.pages.length > 0,
            pageInsights: !!data.pageInsights || !!data.pageDetails,
            businesses: data.businesses && data.businesses.length > 0,
            adAccounts: data.adAccounts && data.adAccounts.length > 0,
          })
          if (data.user) {
            setUserName(data.user.name)
          }
        }
      } catch (err) {
        console.error('Failed to check permissions:', err)
      } finally {
        setLoading(false)
      }
    }

    checkPermissions()
  }, [])

  const grantedCount = Object.values(status).filter(Boolean).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Connected Meta Services
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          POLA-REPORT connects to your Meta accounts to provide comprehensive marketing analytics.
          Below are the Meta API integrations that power your reports.
        </p>
      </div>

      {/* User Info */}
      {userName && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Logged in as</p>
                <h3 className="font-semibold text-gray-900">{userName}</h3>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-600 font-medium">public_profile</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#F5A623]" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {grantedCount} / {Object.keys(status).length}
                </p>
                <p className="text-gray-500">Permissions working</p>
              </div>
              <div className="flex gap-2">
                {Object.entries(status).map(([key, granted]) => (
                  <div
                    key={key}
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      granted ? 'bg-green-100' : 'bg-gray-100'
                    }`}
                  >
                    {granted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Meta API Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {permissions.map((perm) => {
            const Icon = perm.icon
            const isGranted = status[perm.key]

            return (
              <Link key={perm.href} href={perm.href}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`p-3 rounded-lg border ${colorClasses[perm.color as keyof typeof colorClasses]}`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      ) : isGranted ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{perm.title}</h3>
                    <p className="text-sm text-gray-500 mb-3">{perm.description}</p>
                    <div className="flex items-center justify-between">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {perm.permission}
                      </code>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#F5A623] group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Integration Benefits */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">Why These Integrations Matter</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700 space-y-2">
          <p>
            POLA-REPORT uses Meta APIs to provide you with:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Consolidated view of all your Facebook Pages and Ad Accounts</li>
            <li>Real-time performance metrics without switching between tools</li>
            <li>Automated report generation with accurate Meta data</li>
            <li>Cross-account analytics for agencies managing multiple clients</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
