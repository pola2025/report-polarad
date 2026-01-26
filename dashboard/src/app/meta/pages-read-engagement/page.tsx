'use client'

import { useState, useEffect } from 'react'
import { DemoSection, DataCard, DataGrid } from '@/components/demo/DemoSection'
import { Eye, Users, MousePointer, Heart, TrendingUp } from 'lucide-react'

interface PageDetails {
  id: string
  name: string
  category: string
  followers_count?: number
  fan_count?: number
  about?: string
  website?: string
}

interface PageInsights {
  page_impressions?: number
  page_engaged_users?: number
  page_fans?: number
  page_views_total?: number
  page_post_engagements?: number
}

export default function PagesReadEngagementDemo() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageDetails, setPageDetails] = useState<PageDetails | null>(null)
  const [pageInsights, setPageInsights] = useState<PageInsights | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/meta?action=all')
        const json = await res.json()
        if (json.success) {
          setPageDetails(json.data.pageDetails || null)
          setPageInsights(json.data.pageInsights || null)
        } else {
          setError(json.error || 'Failed to fetch data')
        }
      } catch (err) {
        setError('Network error')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const hasData = pageDetails || pageInsights

  return (
    <DemoSection
      permission="pages_read_engagement"
      title="Page Engagement & Insights"
      description="This permission allows the app to read engagement metrics from Facebook Pages, including followers count, page likes (fans), impressions, and post engagement data. POLA-REPORT uses this to display Page performance metrics in marketing reports."
      apiEndpoint="https://graph.facebook.com/v21.0/{page-id}"
      apiFields={['followers_count', 'fan_count', 'insights.metric(page_impressions,page_engaged_users)']}
      userBenefit="Users can track their Page growth and engagement trends over time in one consolidated report, helping them understand what content resonates with their audience without manually checking Facebook Insights."
      status={loading ? 'loading' : error ? 'error' : hasData ? 'success' : 'error'}
      error={error || (!hasData ? 'No page data available' : null)}
    >
      {hasData && (
        <div className="space-y-6">
          {/* Page Info */}
          {pageDetails && (
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
              <h4 className="font-medium text-indigo-900 mb-3">Page Information</h4>
              <DataGrid>
                <DataCard
                  label="Page Name"
                  value={pageDetails.name}
                  subValue={`ID: ${pageDetails.id}`}
                  highlight
                />
                <DataCard
                  label="Category"
                  value={pageDetails.category}
                />
              </DataGrid>
            </div>
          )}

          {/* Engagement Metrics */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Engagement Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Followers</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {pageDetails?.followers_count?.toLocaleString() || '0'}
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-600 mb-1">
                  <Heart className="h-4 w-4" />
                  <span className="text-sm">Page Likes</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {pageDetails?.fan_count?.toLocaleString() || '0'}
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">Impressions</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {pageInsights?.page_impressions?.toLocaleString() || '0'}
                </p>
              </div>

              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center gap-2 text-orange-600 mb-1">
                  <MousePointer className="h-4 w-4" />
                  <span className="text-sm">Engaged Users</span>
                </div>
                <p className="text-2xl font-bold text-orange-700">
                  {pageInsights?.page_engaged_users?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Insights */}
          {pageInsights && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Additional Insights</h4>
              <DataGrid>
                <DataCard
                  label="Total Page Views"
                  value={pageInsights.page_views_total || 0}
                />
                <DataCard
                  label="Post Engagements"
                  value={pageInsights.page_post_engagements || 0}
                />
              </DataGrid>
            </div>
          )}

          {/* How this data is used */}
          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 mb-2">
              How POLA-REPORT uses this data:
            </h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Display follower growth trends in marketing reports</li>
              <li>• Track Page engagement performance over time</li>
              <li>• Calculate engagement rates for campaign analysis</li>
              <li>• Show Page metrics alongside ad performance data</li>
            </ul>
          </div>
        </div>
      )}
    </DemoSection>
  )
}
