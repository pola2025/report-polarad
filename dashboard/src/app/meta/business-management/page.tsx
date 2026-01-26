'use client'

import { useState, useEffect } from 'react'
import { DemoSection, DataCard, DataGrid } from '@/components/demo/DemoSection'
import { Building2, CreditCard, CheckCircle2, TrendingUp } from 'lucide-react'

interface AdAccount {
  id: string
  account_id: string
  name: string
  account_status: number
}

interface Campaign {
  id: string
  name: string
  status: string
  objective: string
  created_time: string
}

export default function BusinessManagementDemo() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/meta?action=all')
        const json = await res.json()
        if (json.success) {
          setAdAccounts(json.data.adAccounts || [])
          setCampaigns(json.data.campaigns || [])
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

  const hasData = adAccounts.length > 0

  const getStatusText = (status: number) => {
    switch (status) {
      case 1: return 'Active'
      case 2: return 'Disabled'
      case 3: return 'Unsettled'
      default: return 'Unknown'
    }
  }

  return (
    <DemoSection
      permission="business_management"
      title="Business & Ad Account Management"
      description="This permission allows the app to access Business Manager information including Ad Accounts. POLA-REPORT uses this to retrieve ad account data and generate marketing performance reports."
      apiEndpoint="https://graph.facebook.com/v21.0/me/adaccounts"
      apiFields={['id', 'account_id', 'name', 'account_status', 'amount_spent', 'currency']}
      userBenefit="View all your Ad Accounts in one place. POLA-REPORT consolidates data from multiple ad accounts to generate unified marketing reports, saving time and providing cross-account insights."
      status={loading ? 'loading' : error ? 'error' : 'success'}
      error={error}
    >
      {!hasData ? (
        <div className="text-center py-8">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Ad Accounts Found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            This account is not associated with any Ad Accounts.
            Please ensure the app has access to your Business Manager or Ad Accounts.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Found <strong>{adAccounts.length}</strong> Ad Account(s) connected to this Business:
          </p>

          {/* Ad Account List */}
          {adAccounts.map((account, index) => (
            <div
              key={account.id}
              className="border rounded-lg overflow-hidden"
            >
              {/* Account Header */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CreditCard className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-mono">
                        Ad Account #{index + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {account.name}
                      </h3>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                      account.account_status === 1
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {account.account_status === 1 && (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {getStatusText(account.account_status)}
                  </span>
                </div>
              </div>

              {/* Account Info */}
              <div className="p-4">
                <DataGrid>
                  <DataCard
                    label="Account ID"
                    value={account.account_id}
                    highlight
                  />
                  <DataCard
                    label="Full ID"
                    value={account.id}
                  />
                </DataGrid>
              </div>
            </div>
          ))}

          {/* Active Campaigns (if available) */}
          {campaigns && campaigns.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <h4 className="font-medium text-gray-900">
                  Active Campaigns ({campaigns.length})
                </h4>
              </div>
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{campaign.name}</p>
                      <p className="text-xs text-gray-500">
                        {campaign.objective.replace('OUTCOME_', '')} | Created: {new Date(campaign.created_time).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        campaign.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How this data is used */}
          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-medium text-purple-800 mb-2">
              How POLA-REPORT uses this data:
            </h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>• Access Ad Account performance metrics for reporting</li>
              <li>• Retrieve campaign data across multiple accounts</li>
              <li>• Generate consolidated marketing analytics</li>
              <li>• Track spend and ROI across business assets</li>
            </ul>
          </div>
        </div>
      )}
    </DemoSection>
  )
}
