/**
 * 구 Airtable → 신 Airtable 리드 백필
 *
 * 구 테이블(appdyFH6v4quVvF4z/tbl6p9tWbl5keMvrI)에서
 * 신 테이블(app1Bh2Ny6eqTERqA/tblaDj4M0Tlq2IRQu)로
 * 누락된 최근 리드를 복사
 *
 * 사용: node scripts/backfill-new-leads-table.js
 */

require('dotenv').config({ path: '.env.local' })

const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY

const OLD_BASE = 'appdyFH6v4quVvF4z'
const OLD_TABLE = 'tbl6p9tWbl5keMvrI'
const NEW_BASE = 'app1Bh2Ny6eqTERqA'
const NEW_TABLE = 'tblaDj4M0Tlq2IRQu'

const headers = {
  Authorization: `Bearer ${AIRTABLE_KEY}`,
  'Content-Type': 'application/json',
}

function normalizePhone(phone) {
  let cleaned = (phone || '').replace(/\D/g, '')
  if (cleaned.startsWith('82') && cleaned.length > 10) {
    cleaned = '0' + cleaned.slice(2)
  }
  return cleaned
}

function formatDate(isoDate) {
  if (!isoDate) return new Date().toISOString().split('T')[0]
  return isoDate.split('T')[0]
}

async function fetchAllOldRecords() {
  const allRecords = []
  let offset

  do {
    const params = new URLSearchParams()
    params.set('pageSize', '100')
    params.set('sort[0][field]', '접수일')
    params.set('sort[0][direction]', 'desc')
    if (offset) params.set('offset', offset)

    const url = `https://api.airtable.com/v0/${OLD_BASE}/${OLD_TABLE}?${params}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } })
    const data = await res.json()

    if (data.error) {
      console.error('Old table fetch error:', data.error)
      break
    }

    allRecords.push(...(data.records || []))
    offset = data.offset
    console.log(`  구 테이블: ${allRecords.length}건 로드...`)
  } while (offset)

  return allRecords
}

async function fetchAllNewPhones() {
  const phones = new Set()
  let offset

  do {
    const params = new URLSearchParams()
    params.set('pageSize', '100')
    params.set('fields[]', '연락처')
    if (offset) params.set('offset', offset)

    const url = `https://api.airtable.com/v0/${NEW_BASE}/${NEW_TABLE}?${params}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } })
    const data = await res.json()

    if (data.error) {
      console.error('New table fetch error:', data.error)
      break
    }

    for (const r of data.records || []) {
      const phone = normalizePhone(r.fields['연락처'] || '')
      if (phone) phones.add(phone)
    }
    offset = data.offset
  } while (offset)

  console.log(`  신 테이블 기존 연락처: ${phones.size}건`)
  return phones
}

async function createRecords(records) {
  // Airtable는 한번에 10건까지
  const batches = []
  for (let i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10))
  }

  let created = 0
  for (const batch of batches) {
    const url = `https://api.airtable.com/v0/${NEW_BASE}/${NEW_TABLE}`
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ records: batch }),
    })
    const data = await res.json()

    if (data.error) {
      console.error('Create error:', data.error)
      continue
    }
    created += (data.records || []).length
  }
  return created
}

async function main() {
  console.log('=== 구 → 신 테이블 리드 백필 ===\n')

  // 1. 구 테이블 전체 로드
  console.log('[1] 구 테이블 로드...')
  const oldRecords = await fetchAllOldRecords()
  console.log(`  총 ${oldRecords.length}건\n`)

  // 2. 신 테이블 기존 연락처 로드
  console.log('[2] 신 테이블 기존 연락처 로드...')
  const existingPhones = await fetchAllNewPhones()
  console.log()

  // 3. 누락된 레코드 필터링
  const missing = []
  const duplicateUpdates = [] // 이미 있는 연락처 (재접수 체크용)

  for (const r of oldRecords) {
    const f = r.fields
    const phone = normalizePhone(f['연락처'] || '')
    if (!phone) continue

    if (existingPhones.has(phone)) {
      // 이미 있음 - 나중에 submission_count 업데이트 필요할 수 있음
      continue
    }

    // 구 테이블 → 신 테이블 필드 매핑
    const date = formatDate(f['접수일'])

    // 문의내용: 구 테이블의 추가 필드들 합산
    const extraFields = []
    if (f['하시는일']) extraFields.push(`하시는일: ${f['하시는일']}`)
    if (f['지역']) extraFields.push(`지역: ${f['지역']}`)
    if (f['위치확인']) extraFields.push(`위치확인: ${f['위치확인']}`)
    if (f['신청일']) extraFields.push(`신청일: ${f['신청일']}`)

    missing.push({
      fields: {
        '이름': f['이름'] || '',
        '연락처': f['연락처'] || '',
        '접수일': date,
        '문의내용': extraFields.join('\n'),
        status: '접수',
        submission_count: 1,
        first_submission_date: date,
        source: 'make_migration',
        campaign: f['캠페인네임'] || '',
        platform: f['플랫폼'] || '',
      },
    })
  }

  console.log(`[3] 누락 레코드: ${missing.length}건`)
  console.log(`    (기존 중복: ${oldRecords.length - missing.length}건 스킵)\n`)

  if (missing.length === 0) {
    console.log('백필할 데이터 없음. 완료.')
    return
  }

  // 4. 신 테이블에 생성
  console.log(`[4] 신 테이블에 ${missing.length}건 생성...`)
  const created = await createRecords(missing)
  console.log(`  생성 완료: ${created}건\n`)

  // 5. 재접수 체크 (전화번호 중복)
  console.log('[5] 재접수(중복 연락처) 체크...')
  const phoneCount = {}
  for (const r of oldRecords) {
    const phone = normalizePhone(r.fields['연락처'] || '')
    if (phone) phoneCount[phone] = (phoneCount[phone] || 0) + 1
  }
  const duplicates = Object.entries(phoneCount).filter(([, count]) => count > 1)
  console.log(`  중복 연락처: ${duplicates.length}건`)
  for (const [phone, count] of duplicates.slice(0, 10)) {
    console.log(`    ${phone}: ${count}회`)
  }

  console.log('\n=== 백필 완료 ===')
}

main().catch(console.error)
