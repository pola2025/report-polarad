'use client'

import { useState, useEffect } from 'react'
import { DemoSection, DataCard, DataGrid } from '@/components/demo/DemoSection'
import { CreditCard, CheckCircle2, XCircle } from 'lucide-react'

interface AdAccount {
  id: string
  account_id: string
  name: string
  account_status: number
  currency?: string
  amount_spent?: string
}

export default function AdsReadPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/meta?action=ad_accounts')
        const json = await res.json()
        if (json.success) {
          setAdAccounts(json.data || [])
        } else {
          setError(json.error || 'Failed to fetch ad accounts')
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

  const getStatusInfo = (status: number) => {
    switch (status) {
      case 1:
        return { label: 'Active', color: 'green', icon: CheckCircle2 }
      case 2:
        return { label: 'Disabled', color: 'red', icon: XCircle }
      case 3:
        return { label: 'Unsettled', color: 'yellow', icon: XCircle }
      default:
        return { label: 'Unknown', color: 'gray', icon: XCircle }
    }
  }

  const hasData = adAccounts.length > 0

  return (
    <DemoSection
      permission="ads_read"
      title="Ad Accounts"
      description="This permission allows the app to read ad account data including account status, spend information, and performance metrics. POLA-REPORT uses this to display ad account performance in marketing reports."
      apiEndpoint="https://graph.facebook.com/v21.0/me/adaccounts"
      apiFields={['id', 'account_id', 'name', 'account_status', 'currency', 'amount_spent']}
      userBenefit="Users can monitor all their ad accounts' status and spending in real-time from a unified dashboard, quickly identifying any accounts that need attention (disabled, unsettled) without logging into Ads Manager."
      status={loading ? 'loading' : error ? 'error' : hasData ? 'success' : 'error'}
      error={error || (!hasData ? 'No ad accounts found' : null)}
    >
      {hasData && (
        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Found <strong>{adAccounts.length}</strong> ad account(s):
          </p>

          {/* Ad Accounts List */}
          <div className="space-y-4">
            {adAccounts.map((account, index) => {
              const statusInfo = getStatusInfo(account.account_status)
              const StatusIcon = statusInfo.icon

              return (
                <div
                  key={account.id}
                  className="border rounded-lg overflow-hidden hover:border-orange-300 transition-colors"
                >
                  {/* Account Header */}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <CreditCard className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 font-mono">
                            Account #{index + 1}
                          </span>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {account.name}
                          </h3>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                          statusInfo.color === 'green'
                            ? 'bg-green-100 text-green-700'
                            : statusInfo.color === 'red'
                            ? 'bg-red-100 text-red-700'
                            : statusInfo.color === 'yellow'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="p-4">
                    <DataGrid>
                      <DataCard
                        label="Account ID"
                        value={account.account_id}
                        subValue={`Full ID: ${account.id}`}
                        highlight
                      />
                      <DataCard
                        label="Status Code"
                        value={account.account_status}
                        subValue={statusInfo.label}
                      />
                    </DataGrid>

                    {(account.currency || account.amount_spent) && (
                      <div className="mt-4">
                        <DataGrid>
                          {account.currency && (
                            <DataCard
                              label="Currency"
                              value={account.currency}
                            />
                          )}
                          {account.amount_spent && (
                            <DataCard
                              label="Amount Spent"
                              value={`${(parseInt(account.amount_spent) / 100).toFixed(2)}`}
                              subValue={account.currency || 'USD'}
                            />
                          )}
                        </DataGrid>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* How this data is used */}
          <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-medium text-orange-800 mb-2">
              How POLA-REPORT uses this data:
            </h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• Display ad account status and health indicators</li>
              <li>• Track total ad spend across accounts</li>
              <li>• Generate performance reports for each ad account</li>
              <li>• Identify accounts that need attention (disabled, unsettled)</li>
            </ul>
          </div>
        </div>
      )}
    </DemoSection>
  )
}
