'use client'

import { useState, useEffect } from 'react'
import { DemoSection, DataCard, DataGrid } from '@/components/demo/DemoSection'
import { Power, PlayCircle, PauseCircle, CreditCard } from 'lucide-react'

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
  effective_status: string
}

export default function AdsManagementPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [updating, setUpdating] = useState<string | null>(null)

  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setUpdating(campaign.id)

    try {
      const res = await fetch('/api/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_campaign_status',
          campaignId: campaign.id,
          status: newStatus,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setCampaigns(campaigns.map(c =>
          c.id === campaign.id ? { ...c, status: newStatus } : c
        ))
      } else {
        alert('Failed to update: ' + data.error)
      }
    } catch {
      alert('Network error')
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        // First get ad accounts
        const accountsRes = await fetch('/api/meta?action=ad_accounts')
        const accountsJson = await accountsRes.json()

        if (accountsJson.success && accountsJson.data?.length > 0) {
          setAdAccounts(accountsJson.data)

          // Then get campaigns for the first ad account
          const campaignsRes = await fetch(`/api/meta?action=campaigns&adAccountId=${accountsJson.data[0].id}`)
          const campaignsJson = await campaignsRes.json()

          if (campaignsJson.success) {
            setCampaigns(campaignsJson.data || [])
          }
        } else {
          setError(accountsJson.error || 'No ad accounts found')
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

  const getStatusIcon = (status: string) => {
    if (status === 'ACTIVE') {
      return <PlayCircle className="w-4 h-4 text-green-500" />
    }
    return <PauseCircle className="w-4 h-4 text-gray-400" />
  }

  return (
    <DemoSection
      permission="ads_management"
      title="Ad Campaign Status Control"
      description="This permission allows the app to manage ad campaigns, including turning campaigns on (ACTIVE) or off (PAUSED). POLA-REPORT uses this to give users quick control over their ad campaigns directly from the analytics dashboard."
      apiEndpoint="https://graph.facebook.com/v22.0/{campaign-id}"
      apiFields={['status (POST)', 'effective_status', 'id', 'name']}
      userBenefit="Users can quickly pause underperforming campaigns or activate new ones directly from POLA-REPORT without switching to Ads Manager. This streamlines campaign management and allows faster response to performance changes."
      status={loading ? 'loading' : error ? 'error' : hasData ? 'success' : 'error'}
      error={error || (!hasData ? 'No ad accounts found' : null)}
    >
      {hasData && (
        <div className="space-y-6">
          {/* Ad Account Info */}
          <div className="p-4 bg-gradient-to-r from-rose-50 to-orange-50 rounded-lg border border-rose-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Managing campaigns for</p>
                <h4 className="font-semibold text-gray-900">{adAccounts[0].name}</h4>
              </div>
            </div>
            <DataGrid>
              <DataCard
                label="Account ID"
                value={adAccounts[0].account_id}
                highlight
              />
              <DataCard
                label="Account Status"
                value={adAccounts[0].account_status === 1 ? 'Active' : 'Inactive'}
              />
            </DataGrid>
          </div>

          {/* Campaign Control Demo */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Power className="w-5 h-5 text-rose-500" />
              Campaign Status Control
            </h4>

            {campaigns.length > 0 ? (
              <div className="space-y-3">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="border rounded-lg p-4 hover:border-rose-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(campaign.status)}
                        <div>
                          <p className="font-medium text-gray-900">{campaign.name}</p>
                          <p className="text-xs text-gray-500">
                            {campaign.objective?.replace('OUTCOME_', '')} | ID: {campaign.id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 text-sm rounded-full font-medium ${
                            campaign.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : campaign.status === 'PAUSED'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {campaign.status}
                        </span>
                        {/* Toggle button - actually controls campaign status */}
                        <button
                          className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                          disabled={updating === campaign.id}
                          onClick={() => handleToggleStatus(campaign)}
                        >
                          {updating === campaign.id ? 'Updating...' : campaign.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Power className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No campaigns found in this ad account</p>
                <p className="text-sm text-gray-400 mt-1">
                  Campaigns will appear here once created in Ads Manager
                </p>
              </div>
            )}
          </div>

          {/* API Usage Example */}
          <div className="p-4 bg-gray-900 rounded-lg text-sm font-mono">
            <p className="text-gray-400 mb-2"># Example: Pause a campaign</p>
            <p className="text-green-400">POST /v22.0/{'{campaign_id}'}</p>
            <p className="text-blue-400 mt-1">{'{ "status": "PAUSED" }'}</p>
            <p className="text-gray-400 mt-3"># Example: Activate a campaign</p>
            <p className="text-green-400">POST /v22.0/{'{campaign_id}'}</p>
            <p className="text-blue-400 mt-1">{'{ "status": "ACTIVE" }'}</p>
          </div>

          {/* How this data is used */}
          <div className="mt-6 p-4 bg-rose-50 rounded-lg border border-rose-200">
            <h4 className="font-medium text-rose-800 mb-2">
              How POLA-REPORT uses this permission:
            </h4>
            <ul className="text-sm text-rose-700 space-y-1">
              <li>• Pause underperforming campaigns directly from the dashboard</li>
              <li>• Activate campaigns when ready to launch</li>
              <li>• Quick status toggle without leaving the analytics view</li>
              <li>• Bulk campaign management for efficiency</li>
            </ul>
          </div>
        </div>
      )}
    </DemoSection>
  )
}
