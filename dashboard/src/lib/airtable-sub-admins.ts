/**
 * 서브관리자 Airtable CRUD
 *
 * Base: appC3XKBcYgZBTETn (클라이언트 설정)
 * Table: tbleJ7nnAMRgb8KsK (sub_admins)
 */

import type { AdminScope } from './admin-auth'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const BASE_ID = 'appC3XKBcYgZBTETn'
const TABLE_ID = 'tbleJ7nnAMRgb8KsK'

const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
}

export interface SubAdmin {
  id: string
  name: string
  email: string
  scope: AdminScope
  is_active: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any): SubAdmin {
  const f = record.fields
  return {
    id: record.id,
    name: f['name'] || '',
    email: (f['email'] || '').toLowerCase().trim(),
    scope: (f['scope'] || 'bas-naratton') as AdminScope,
    is_active: f['is_active'] === true,
  }
}

/** 모든 활성 서브관리자 조회 */
export async function getActiveSubAdmins(): Promise<SubAdmin[]> {
  const params = new URLSearchParams()
  params.set('filterByFormula', '{is_active}=TRUE()')

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  })
  const data = await res.json()

  if (data.error) {
    console.error('getActiveSubAdmins error:', data.error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records || []).map((r: any) => mapRecord(r))
}

/** 전체 서브관리자 조회 (관리 UI용) */
export async function getAllSubAdmins(): Promise<SubAdmin[]> {
  const res = await fetch(BASE_URL, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  })
  const data = await res.json()

  if (data.error) {
    console.error('getAllSubAdmins error:', data.error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records || []).map((r: any) => mapRecord(r))
}

/** 서브관리자 추가 */
export async function createSubAdmin(
  name: string,
  email: string,
  scope: AdminScope = 'bas-naratton'
): Promise<SubAdmin | null> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fields: {
        name,
        email: email.toLowerCase().trim(),
        scope,
        is_active: true,
      },
    }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('createSubAdmin error:', data.error)
    return null
  }

  return mapRecord(data)
}

/** 서브관리자 삭제 */
export async function deleteSubAdmin(recordId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
  })
  const data = await res.json()

  if (data.error) {
    console.error('deleteSubAdmin error:', data.error)
    return false
  }

  return !!data.deleted
}

/** 이메일로 서브관리자 조회 */
export async function findSubAdminByEmail(
  email: string
): Promise<SubAdmin | null> {
  const normalized = email.toLowerCase().trim()
  const params = new URLSearchParams()
  params.set(
    'filterByFormula',
    `AND({is_active}=TRUE(), LOWER({email})='${normalized.replace(/'/g, "\\'")}')`
  )
  params.set('maxRecords', '1')

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  })
  const data = await res.json()

  if (data.error || !data.records?.length) return null
  return mapRecord(data.records[0])
}
