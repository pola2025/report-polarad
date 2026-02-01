'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import {
  Search,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  client_name: string
  slug: string
}

interface KeywordStat {
  id?: number
  client_id: string
  year_month: string
  keyword: string
  pc_searches: number
  mobile_searches: number
  total_searches?: number
}

// 키워드별로 그룹화된 데이터
interface KeywordGroup {
  keyword: string
  months: Record<string, { pc: number; mobile: number; id?: number }>
  isNew?: boolean
}

export default function KeywordsUploadPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [newKeywordInput, setNewKeywordInput] = useState('')

  // 기간 필터
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')

  // 선택 가능한 월 목록 (2024-01부터 현재까지)
  const getAllMonths = () => {
    const months: string[] = []
    const now = new Date()
    const start = new Date(2024, 0, 1) // 2024년 1월부터

    const current = new Date(now.getFullYear(), now.getMonth(), 1)
    while (current >= start) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`)
      current.setMonth(current.getMonth() - 1)
    }
    return months
  }

  const allMonths = getAllMonths()

  // 초기값 설정
  useEffect(() => {
    if (allMonths.length > 0 && !startMonth) {
      setStartMonth(allMonths[0]) // 현재 월
      setEndMonth(allMonths[Math.min(11, allMonths.length - 1)]) // 12개월 전 또는 가능한 가장 오래된 월
    }
  }, [allMonths, startMonth])

  // 필터된 월 목록
  const displayMonths = allMonths.filter(month => {
    if (!startMonth || !endMonth) return true
    return month <= startMonth && month >= endMonth
  })

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/clients')

      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
      }
    } catch (error) {
      console.error('클라이언트 조회 실패:', error)
    }
  }, [])

  const fetchKeywords = useCallback(async () => {
    if (!selectedClient) return

    setLoading(true)
    try {
      const params = new URLSearchParams({ clientId: selectedClient })
      const response = await fetch(`/api/admin/keywords?${params}`)

      if (response.ok) {
        const data = await response.json()
        const rawData: KeywordStat[] = data.data || []

        // 키워드별로 그룹화
        const groupMap = new Map<string, KeywordGroup>()

        rawData.forEach(item => {
          if (!groupMap.has(item.keyword)) {
            groupMap.set(item.keyword, {
              keyword: item.keyword,
              months: {},
            })
          }
          const group = groupMap.get(item.keyword)!
          group.months[item.year_month] = {
            pc: item.pc_searches || 0,
            mobile: item.mobile_searches || 0,
            id: item.id,
          }
        })

        setKeywordGroups(Array.from(groupMap.values()))
      }
    } catch (error) {
      console.error('키워드 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedClient])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    if (selectedClient) {
      fetchKeywords()
    }
  }, [selectedClient, fetchKeywords])

  // 새 키워드 추가
  const addNewKeyword = () => {
    const keyword = newKeywordInput.trim()
    if (!keyword) {
      setMessage({ type: 'error', text: '키워드를 입력하세요.' })
      return
    }

    if (keywordGroups.some(g => g.keyword === keyword)) {
      setMessage({ type: 'error', text: '이미 존재하는 키워드입니다.' })
      return
    }

    setKeywordGroups([
      ...keywordGroups,
      {
        keyword,
        months: {},
        isNew: true,
      },
    ])
    setNewKeywordInput('')
    setMessage(null)
  }

  // 값 변경
  const updateValue = (keywordIndex: number, month: string, field: 'pc' | 'mobile', value: number) => {
    const updated = [...keywordGroups]
    if (!updated[keywordIndex].months[month]) {
      updated[keywordIndex].months[month] = { pc: 0, mobile: 0 }
    }
    updated[keywordIndex].months[month][field] = value
    setKeywordGroups(updated)
  }

  // 키워드 삭제
  const deleteKeyword = async (keywordIndex: number) => {
    const group = keywordGroups[keywordIndex]

    if (!confirm(`"${group.keyword}" 키워드의 모든 데이터를 삭제하시겠습니까?`)) {
      return
    }

    const idsToDelete = Object.values(group.months)
      .filter(m => m.id)
      .map(m => m.id)

    for (const id of idsToDelete) {
      try {
        await fetch(`/api/admin/keywords?id=${id}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('삭제 실패:', error)
      }
    }

    setKeywordGroups(keywordGroups.filter((_, i) => i !== keywordIndex))
    setMessage({ type: 'success', text: '삭제되었습니다.' })
  }

  // 저장
  const handleSave = async () => {
    const records: Array<{
      clientId: string
      yearMonth: string
      keyword: string
      pcSearches: number
      mobileSearches: number
    }> = []

    // 변경된 데이터만 저장 (입력된 모든 월 포함, 값이 있는 것만)
    keywordGroups.forEach(group => {
      // 키워드에 데이터가 있는 모든 월을 저장 (displayMonths와 관계없이)
      Object.keys(group.months).forEach(month => {
        const data = group.months[month]
        // 값이 하나라도 있으면 저장 (0도 유효한 값으로 처리)
        if (data && (data.pc !== undefined || data.mobile !== undefined)) {
          // PC나 Mobile 둘 중 하나라도 값이 있거나, 기존 DB 레코드가 있으면 저장
          if (data.pc > 0 || data.mobile > 0 || data.id) {
            records.push({
              clientId: selectedClient,
              yearMonth: month,
              keyword: group.keyword.trim(), // 공백 제거
              pcSearches: data.pc || 0,
              mobileSearches: data.mobile || 0,
            })
          }
        }
      })
    })

    if (records.length === 0) {
      setMessage({ type: 'error', text: '저장할 데이터가 없습니다.' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: `${records.length}건 저장 완료 (upsert)` })
        // 저장 후 데이터 새로고침
        await fetchKeywords()
      } else {
        setMessage({ type: 'error', text: data.error || '저장 실패' })
      }
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  // 합계 계산
  const calculateTotals = () => {
    const totals: Record<string, { pc: number; mobile: number }> = {}
    displayMonths.forEach(month => {
      totals[month] = { pc: 0, mobile: 0 }
    })

    keywordGroups.forEach(group => {
      displayMonths.forEach(month => {
        const data = group.months[month]
        if (data) {
          totals[month].pc += data.pc || 0
          totals[month].mobile += data.mobile || 0
        }
      })
    })

    return totals
  }

  const totals = calculateTotals()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">상호명 검색 키워드 통계</h1>
                <p className="text-sm text-gray-500">키워드별 월별 검색량을 입력합니다 (최근 12개월)</p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving || !selectedClient}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 클라이언트 및 기간 선택 */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  클라이언트
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">선택하세요</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.client_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  기간
                </label>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {allMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                <span className="text-gray-500">~</span>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {allMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-500">
                  ({displayMonths.length}개월)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 메시지 */}
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-md mb-4 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            {message.text}
          </div>
        )}

        {!selectedClient ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              클라이언트를 선택하세요
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              로딩 중...
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 새 키워드 추가 */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNewKeyword()}
                    placeholder="새 키워드 입력 (예: H.E.A 판교)"
                    className="flex-1 max-w-md px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <Button onClick={addNewKeyword} variant="secondary">
                    <Plus className="h-4 w-4 mr-2" />
                    키워드 추가
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 키워드별 입력 테이블 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-5 w-5" />
                  키워드별 월별 검색량 (PC / Mobile)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {keywordGroups.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    등록된 키워드가 없습니다. 위에서 키워드를 추가하세요.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b">
                          <th className="px-2 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-100 border-r whitespace-nowrap">
                            키워드
                          </th>
                          {displayMonths.map(month => (
                            <th key={month} className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[120px] border-r">
                              {month}
                            </th>
                          ))}
                          <th className="px-2 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {keywordGroups.map((group, keywordIndex) => (
                          <tr key={group.keyword} className="border-b hover:bg-gray-50">
                            <td className="px-2 py-1 sticky left-0 bg-white border-r whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-gray-900">{group.keyword}</span>
                                {group.isNew && (
                                  <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                                    신규
                                  </span>
                                )}
                              </div>
                            </td>
                            {displayMonths.map(month => {
                              const data = group.months[month] || { pc: 0, mobile: 0 }
                              return (
                                <td key={month} className="px-1 py-1 border-r">
                                  <div className="flex gap-1 justify-center">
                                    <input
                                      type="number"
                                      value={data.pc || ''}
                                      onChange={(e) =>
                                        updateValue(keywordIndex, month, 'pc', Number(e.target.value) || 0)
                                      }
                                      placeholder="PC"
                                      className="w-14 px-1 py-1 border border-blue-200 rounded text-right text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <input
                                      type="number"
                                      value={data.mobile || ''}
                                      onChange={(e) =>
                                        updateValue(keywordIndex, month, 'mobile', Number(e.target.value) || 0)
                                      }
                                      placeholder="Mob"
                                      className="w-14 px-1 py-1 border border-green-200 rounded text-right text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                    />
                                  </div>
                                </td>
                              )
                            })}
                            <td className="px-1 py-1 text-center">
                              <button
                                onClick={() => deleteKeyword(keywordIndex)}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td className="px-2 py-2 font-semibold text-gray-700 sticky left-0 bg-gray-50 border-r whitespace-nowrap">
                            PC 합계
                          </td>
                          {displayMonths.map(month => (
                            <td key={month} className="px-2 py-2 text-center font-medium text-blue-600 border-r">
                              {formatNumber(totals[month].pc)}
                            </td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-2 py-2 font-semibold text-gray-700 sticky left-0 bg-gray-50 border-r whitespace-nowrap">
                            Mobile 합계
                          </td>
                          {displayMonths.map(month => (
                            <td key={month} className="px-2 py-2 text-center font-medium text-green-600 border-r">
                              {formatNumber(totals[month].mobile)}
                            </td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="bg-blue-50 border-t">
                          <td className="px-2 py-2 font-bold text-gray-900 sticky left-0 bg-blue-50 border-r whitespace-nowrap">
                            월별 총합
                          </td>
                          {displayMonths.map(month => (
                            <td key={month} className="px-2 py-2 text-center font-bold text-blue-700 border-r">
                              {formatNumber(totals[month].pc + totals[month].mobile)}
                            </td>
                          ))}
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 도움말 */}
            <div className="text-sm text-gray-500 px-2">
              💡 파란색 입력창 = PC 검색량, 초록색 입력창 = Mobile 검색량 | 저장 후 대시보드에 자동 반영됩니다.
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
