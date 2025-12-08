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
  TrendingUp,
  TrendingDown,
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
  notes?: string
  isNew?: boolean
}

interface MonthlySummary {
  year_month: string
  total_pc: number
  total_mobile: number
  total_searches: number
  keyword_count: number
}

export default function KeywordsUploadPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [keywords, setKeywords] = useState<KeywordStat[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [adminKey, setAdminKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 현재 월 기본값
  const getCurrentMonth = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  useEffect(() => {
    const savedKey = localStorage.getItem('polarad_admin_key')
    if (savedKey) {
      setAdminKey(savedKey)
      setIsAuthenticated(true)
    }
    setSelectedMonth(getCurrentMonth())
  }, [])

  const fetchClients = useCallback(async () => {
    if (!adminKey) return

    try {
      const response = await fetch('/api/admin/clients', {
        headers: { 'x-admin-key': adminKey },
      })

      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
      }
    } catch (error) {
      console.error('클라이언트 조회 실패:', error)
    }
  }, [adminKey])

  const fetchKeywords = useCallback(async () => {
    if (!adminKey || !selectedClient) return

    setLoading(true)
    try {
      const params = new URLSearchParams({ clientId: selectedClient })
      if (selectedMonth) params.append('yearMonth', selectedMonth)

      const response = await fetch(`/api/admin/keywords?${params}`, {
        headers: { 'x-admin-key': adminKey },
      })

      if (response.ok) {
        const data = await response.json()
        setKeywords(data.data || [])
        setMonthlySummary(data.monthlySummary || [])
      }
    } catch (error) {
      console.error('키워드 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [adminKey, selectedClient, selectedMonth])

  useEffect(() => {
    if (adminKey) {
      fetchClients()
    }
  }, [adminKey, fetchClients])

  useEffect(() => {
    if (selectedClient) {
      fetchKeywords()
    }
  }, [selectedClient, selectedMonth, fetchKeywords])

  const handleLogin = () => {
    if (adminKey) {
      localStorage.setItem('polarad_admin_key', adminKey)
      setIsAuthenticated(true)
      fetchClients()
    }
  }

  // 새 키워드 행 추가
  const addNewKeyword = () => {
    if (!selectedClient || !selectedMonth) {
      setMessage({ type: 'error', text: '클라이언트와 월을 먼저 선택하세요.' })
      return
    }

    setKeywords([
      ...keywords,
      {
        client_id: selectedClient,
        year_month: selectedMonth,
        keyword: '',
        pc_searches: 0,
        mobile_searches: 0,
        isNew: true,
      },
    ])
  }

  // 키워드 변경
  const updateKeyword = (index: number, field: keyof KeywordStat, value: string | number) => {
    const updated = [...keywords]
    updated[index] = { ...updated[index], [field]: value }
    setKeywords(updated)
  }

  // 키워드 삭제
  const deleteKeyword = async (index: number) => {
    const keyword = keywords[index]

    if (keyword.id && !keyword.isNew) {
      // DB에서 삭제
      try {
        const response = await fetch(`/api/admin/keywords?id=${keyword.id}`, {
          method: 'DELETE',
          headers: { 'x-admin-key': adminKey },
        })

        if (!response.ok) {
          throw new Error('삭제 실패')
        }
      } catch {
        setMessage({ type: 'error', text: '삭제 중 오류가 발생했습니다.' })
        return
      }
    }

    // 목록에서 제거
    setKeywords(keywords.filter((_, i) => i !== index))
    setMessage({ type: 'success', text: '삭제되었습니다.' })
  }

  // 저장
  const handleSave = async () => {
    const toSave = keywords.filter((k) => k.keyword.trim())

    if (toSave.length === 0) {
      setMessage({ type: 'error', text: '저장할 키워드가 없습니다.' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const records = toSave.map((k) => ({
        clientId: k.client_id,
        yearMonth: k.year_month,
        keyword: k.keyword.trim(),
        pcSearches: Number(k.pc_searches) || 0,
        mobileSearches: Number(k.mobile_searches) || 0,
        notes: k.notes || null,
      }))

      const response = await fetch('/api/admin/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ records }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        fetchKeywords() // 새로고침
      } else {
        setMessage({ type: 'error', text: data.error || '저장 실패' })
      }
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  // 월 목록 생성 (2024년 12월부터 현재까지)
  const getMonthOptions = () => {
    const months: string[] = []
    const now = new Date()
    const startDate = new Date(2024, 11, 1) // 2024년 12월

    // 현재 월부터 역순으로
    const current = new Date(now.getFullYear(), now.getMonth(), 1)
    while (current >= startDate) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`)
      current.setMonth(current.getMonth() - 1)
    }
    return months
  }

  // 인증 전 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>관리자 로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="관리자 키 입력"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button onClick={handleLogin} className="w-full">
                로그인
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 현재 월의 합계
  const currentMonthTotal = keywords.reduce(
    (acc, k) => ({
      pc: acc.pc + (Number(k.pc_searches) || 0),
      mobile: acc.mobile + (Number(k.mobile_searches) || 0),
    }),
    { pc: 0, mobile: 0 }
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">상호명 검색 키워드 통계</h1>
              <p className="text-sm text-gray-500">월별 키워드 검색량을 입력합니다</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 메인 영역 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 필터 */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      클라이언트
                    </label>
                    <select
                      value={selectedClient}
                      onChange={(e) => setSelectedClient(e.target.value)}
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">선택하세요</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.client_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      월 선택
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      {getMonthOptions().map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 메시지 */}
            {message && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md ${
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

            {/* 키워드 입력 테이블 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    키워드 검색량 입력
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={addNewKeyword}>
                      <Plus className="h-4 w-4 mr-1" />
                      행 추가
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" />
                      {saving ? '저장 중...' : '저장'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedClient ? (
                  <p className="text-center text-gray-500 py-8">클라이언트를 선택하세요</p>
                ) : loading ? (
                  <p className="text-center text-gray-500 py-8">로딩 중...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">
                            키워드
                          </th>
                          <th className="px-3 py-2 text-right text-sm font-medium text-gray-500 w-28">
                            PC 조회수
                          </th>
                          <th className="px-3 py-2 text-right text-sm font-medium text-gray-500 w-28">
                            Mobile 조회수
                          </th>
                          <th className="px-3 py-2 text-right text-sm font-medium text-gray-500 w-28">
                            합계
                          </th>
                          <th className="px-3 py-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {keywords.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                              데이터가 없습니다. &quot;행 추가&quot; 버튼을 클릭하세요.
                            </td>
                          </tr>
                        ) : (
                          keywords.map((kw, index) => (
                            <tr key={kw.id || `new-${index}`} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={kw.keyword}
                                  onChange={(e) => updateKeyword(index, 'keyword', e.target.value)}
                                  placeholder="키워드 입력"
                                  className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={kw.pc_searches}
                                  onChange={(e) =>
                                    updateKeyword(index, 'pc_searches', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={kw.mobile_searches}
                                  onChange={(e) =>
                                    updateKeyword(index, 'mobile_searches', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {formatNumber(
                                  (Number(kw.pc_searches) || 0) + (Number(kw.mobile_searches) || 0)
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => deleteKeyword(index)}
                                  className="text-gray-400 hover:text-red-500"
                                  title="삭제"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {keywords.length > 0 && (
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td className="px-3 py-2 font-medium">합계</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatNumber(currentMonthTotal.pc)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatNumber(currentMonthTotal.mobile)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-blue-600">
                              {formatNumber(currentMonthTotal.pc + currentMonthTotal.mobile)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 사이드바 - 월별 요약 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">월별 검색량 추이</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlySummary.length === 0 ? (
                  <p className="text-sm text-gray-500">데이터가 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {monthlySummary.slice(0, 6).map((summary, index) => {
                      const prev = monthlySummary[index + 1]
                      const change = prev
                        ? ((summary.total_searches - prev.total_searches) / prev.total_searches) * 100
                        : 0

                      return (
                        <div
                          key={summary.year_month}
                          className={`p-3 rounded-md ${
                            index === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{summary.year_month}</span>
                            {prev && (
                              <span
                                className={`flex items-center text-xs ${
                                  change >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {change >= 0 ? (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                )}
                                {Math.abs(change).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {formatNumber(summary.total_searches)}
                          </div>
                          <div className="text-xs text-gray-500">
                            PC {formatNumber(summary.total_pc)} / Mobile{' '}
                            {formatNumber(summary.total_mobile)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {summary.keyword_count}개 키워드
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 도움말 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">입력 안내</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• 네이버 키워드 도구에서 조회한 검색량을 입력합니다.</li>
                  <li>• 상호명, 브랜드명, 관련 키워드를 등록하세요.</li>
                  <li>• 같은 월에 같은 키워드는 덮어쓰기됩니다.</li>
                </ul>
                <div className="mt-4">
                  <Link href="/admin" className="text-sm text-blue-600 hover:underline">
                    ← 관리자 페이지로 돌아가기
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
