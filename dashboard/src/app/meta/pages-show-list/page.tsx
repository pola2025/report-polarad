'use client'

import { useState, useEffect } from 'react'
import { DemoSection, DataCard, DataGrid } from '@/components/demo/DemoSection'

interface Page {
  id: string
  name: string
  category: string
  access_token?: string
  tasks?: string[]
  followers_count?: number
  fan_count?: number
}

export default function PagesShowListDemo() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pages, setPages] = useState<Page[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/meta?action=pages')
        const json = await res.json()
        if (json.success) {
          setPages(json.data || [])
        } else {
          setError(json.error || 'Failed to fetch pages')
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

  return (
    <DemoSection
      permission="pages_show_list"
      title="List of Facebook Pages"
      description="This permission allows the app to display the list of Facebook Pages that the logged-in user manages. POLA-REPORT uses this to let users select which Page's ad performance they want to track and analyze."
      apiEndpoint="https://graph.facebook.com/v21.0/me/accounts"
      apiFields={['id', 'name', 'category', 'access_token', 'tasks']}
      userBenefit="Users can easily select and manage multiple Facebook Pages from a single dashboard, eliminating the need to switch between different accounts or use Meta Business Suite separately."
      status={loading ? 'loading' : error ? 'error' : 'success'}
      error={error}
    >
      {pages.length > 0 ? (
        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Found <strong>{pages.length}</strong> page(s) that you manage:
          </p>

          <div className="space-y-4">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-gray-400 font-mono">
                      Page #{index + 1}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {page.name}
                    </h3>
                    <p className="text-sm text-gray-500">{page.category}</p>
                  </div>
                  {page.access_token && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                      Has Page Token
                    </span>
                  )}
                </div>

                <DataGrid>
                  <DataCard
                    label="Page ID"
                    value={page.id}
                    highlight
                  />
                  <DataCard
                    label="Category"
                    value={page.category || 'Not specified'}
                  />
                </DataGrid>

                {page.tasks && page.tasks.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">Page Tasks (Permissions):</p>
                    <div className="flex flex-wrap gap-1">
                      {page.tasks.map((task) => (
                        <span
                          key={task}
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* How this data is used */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">
              How POLA-REPORT uses this data:
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Display a list of Pages for the user to select</li>
              <li>• Retrieve Page Access Tokens for making Page-level API calls</li>
              <li>• Show Page names in reports and dashboards</li>
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">
          No pages found. Make sure you have admin access to at least one Facebook Page.
        </p>
      )}
    </DemoSection>
  )
}
