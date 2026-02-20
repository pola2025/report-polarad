/**
 * Vercel Cron - BAS 리드 동기화
 *
 * OLD 테이블(Make.com) → NEW 테이블(대시보드) 동기화
 * 5분마다 실행, 24시간 lookback window
 *
 * 로직:
 * 1. OLD 테이블에서 최근 24시간 내 레코드 조회
 * 2. NEW 테이블에서 전화번호로 중복 체크
 * 3. 같은 접수일 → skip (이미 동기화)
 * 4. 다른 접수일 → 재접수 처리
 * 5. 없음 → 신규 생성
 * 6. 텔레그램 알림
 *
 * 수동 백필:
 *   GET /api/cron/lead-sync?since=2026-02-12&until=2026-02-20&notify=false
 *   - since: 조회 시작일 (YYYY-MM-DD), 기본 24시간 전
 *   - until: 조회 종료일 (YYYY-MM-DD), 기본 현재
 *   - notify: 텔레그램 알림 여부 (기본 true, 백필 시 false 권장)
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const OLD_BASE = 'appdyFH6v4quVvF4z'
const OLD_TABLE = 'tbl6p9tWbl5keMvrI'
const NEW_BASE = process.env.AIRTABLE_BAS_LEADS_BASE_ID || 'app1Bh2Ny6eqTERqA'
const NEW_TABLE = process.env.AIRTABLE_BAS_LEADS_TABLE_ID || 'tblaDj4M0Tlq2IRQu'
const AIRTABLE_TOKEN = (process.env.AIRTABLE_API_KEY || '').trim()
const TG_CHAT = '-1003394139746'
const DASH_URL = 'https://report.polarad.co.kr/?client=bas&tab=lead-management'

// 인증
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === process.env.ADMIN_KEY
}

// 전화번호 정규화
function normPhone(p: string): string {
  let c = (p || '').replace(/\D/g, '')
  if (c.startsWith('82') && c.length > 10) c = '0' + c.slice(2)
  return c
}

// 날짜만 추출 (YYYY-MM-DD)
function dateOnly(d: string): string {
  return d ? d.split('T')[0] : new Date().toISOString().split('T')[0]
}

// Airtable API 호출
async function airtableFetch(base: string, path: string, options?: RequestInit) {
  const url = `https://api.airtable.com/v0/${base}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    console.error(`[lead-sync] Airtable API error: ${res.status}`, JSON.stringify(data.error || data))
    throw new Error(`Airtable ${res.status}: ${JSON.stringify(data.error || data)}`)
  }
  return data
}

// 텔레그램 알림
async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  } catch (e) {
    console.error('[lead-sync] Telegram error:', e)
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  let created = 0, resubmitted = 0, skipped = 0, errors = 0
  const errorDetails: string[] = []

  // 쿼리 파라미터로 날짜 범위 지정 가능 (수동 백필용)
  const url = new URL(request.url)
  const sinceParam = url.searchParams.get('since')
  const untilParam = url.searchParams.get('until')
  const notifyParam = url.searchParams.get('notify')
  const debugParam = url.searchParams.get('debug')
  const shouldNotify = notifyParam !== 'false'
  const isDebug = debugParam === 'true'

  try {
    // 1. OLD 테이블에서 레코드 조회 (페이지네이션 포함)
    let formula: string
    if (sinceParam) {
      // 수동 백필: 접수일 기반 날짜 범위 필터
      const sinceDate = sinceParam
      const untilDate = untilParam || new Date().toISOString().split('T')[0]
      formula = encodeURIComponent(
        `AND(IS_AFTER({접수일},'${sinceDate}'), IS_BEFORE({접수일},'${untilDate}T23:59:59'))`
      )
      console.log(`[lead-sync] 수동 백필 모드: ${sinceDate} ~ ${untilDate}`)
    } else {
      // 기본: 최근 24시간 내 CREATED_TIME
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      formula = encodeURIComponent(`IS_AFTER(CREATED_TIME(),'${since}')`)
    }

    // 페이지네이션으로 모든 레코드 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldRecords: any[] = []
    let offset: string | undefined

    do {
      let fetchUrl = `/${OLD_TABLE}?filterByFormula=${formula}&pageSize=100`
      if (offset) fetchUrl += `&offset=${offset}`

      const oldData = await airtableFetch(OLD_BASE, fetchUrl)

      if (oldData.error) {
        console.error('[lead-sync] OLD table error:', oldData.error)
        return NextResponse.json({ error: 'OLD table query failed', detail: oldData.error }, { status: 500 })
      }

      oldRecords.push(...(oldData.records || []))
      offset = oldData.offset
    } while (offset)

    if (oldRecords.length === 0) {
      return NextResponse.json({
        ok: true,
        message: sinceParam ? `No leads found (${sinceParam} ~ ${untilParam || 'now'})` : 'No new leads (24h window)',
        created: 0, resubmitted: 0, skipped: 0,
        duration: Date.now() - startTime,
      })
    }

    console.log(`[lead-sync] OLD 테이블에서 ${oldRecords.length}건 조회됨`)
    if (isDebug) {
      console.log(`[lead-sync] DEBUG: NEW_BASE=${NEW_BASE}, NEW_TABLE=${NEW_TABLE}, TOKEN_LEN=${AIRTABLE_TOKEN.length}`)
    }

    // 2. 각 레코드 처리
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const record of oldRecords) {
      const f = record.fields
      const phone = normPhone(f['연락처'] || '')
      if (!phone) { skipped++; continue }

      const name = f['이름'] || ''
      const dateRaw = f['접수일'] || ''
      const date = dateOnly(dateRaw)
      const dateFull = dateRaw || new Date().toISOString()
      const campaign = f['캠페인네임'] || ''
      const platform = f['플랫폼'] || ''
      const seminarDate = f['신청일'] || ''

      try {
        // NEW 테이블에서 같은 연락처 검색
        const searchFormula = encodeURIComponent(`FIND('${phone}',SUBSTITUTE({연락처},"-",""))>0`)
        const searchData = await airtableFetch(
          NEW_BASE,
          `/${NEW_TABLE}?filterByFormula=${searchFormula}&pageSize=1&sort%5B0%5D%5Bfield%5D=%EC%A0%91%EC%88%98%EC%9D%BC&sort%5B0%5D%5Bdirection%5D=desc`
        )

        const existing = searchData.records?.[0]

        if (existing) {
          const ef = existing.fields
          const existDate = dateOnly(ef['접수일'] || '')

          // 같은 접수일 = 이미 동기화됨
          if (existDate === date) {
            skipped++
            continue
          }

          // 다른 접수일 = 재접수
          const cnt = (ef.submission_count || 1) + 1
          const hist = (ef.submission_history || '') + `\n${cnt}차: ${date}`

          await airtableFetch(NEW_BASE, `/${NEW_TABLE}/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              fields: {
                status: '심사준비',
                submission_count: cnt,
                submission_history: hist,
                previous_status: ef.status || '',
                previous_staff: ef.assigned_staff || '',
                '접수일': date,
                '접수일시': dateFull,
                '참석희망일': seminarDate,
                campaign,
                last_updated_by: 'cron_sync',
              },
            }),
          })

          resubmitted++

          if (shouldNotify) {
            await sendTelegram(
              `<b>[BAS 리드 재접수 (${cnt}회차)]</b>\n이름: ${name}\n연락처: ${phone}` +
              (seminarDate ? `\n참석희망일: ${seminarDate}` : '') +
              (campaign ? `\n광고명: ${campaign}` : '') +
              `\n접수일: ${date}\n\n<a href="${DASH_URL}">리드관리 바로가기</a>`
            )
          }
        } else {
          // 신규 생성
          await airtableFetch(NEW_BASE, `/${NEW_TABLE}`, {
            method: 'POST',
            body: JSON.stringify({
              fields: {
                '이름': name,
                '연락처': f['연락처'] || '',
                '접수일': date,
                '접수일시': dateFull,
                '참석희망일': seminarDate,
                status: '심사준비',
                submission_count: 1,
                first_submission_date: date,
                source: 'cron_sync',
                campaign,
                platform,
              },
            }),
          })

          created++

          if (shouldNotify) {
            const platformLabel = platform === 'fb' ? 'Facebook' : platform === 'ig' ? 'Instagram' : platform
            await sendTelegram(
              `<b>[BAS 리드 신규]</b>\n이름: ${name}\n연락처: ${phone}` +
              (seminarDate ? `\n참석희망일: ${seminarDate}` : '') +
              (campaign ? `\n광고명: ${campaign}` : '') +
              (platform ? `\n플랫폼: ${platformLabel}` : '') +
              `\n접수일: ${date}\n\n<a href="${DASH_URL}">리드관리 바로가기</a>`
            )
          }
        }
      } catch (e) {
        const errMsg = `${name} ${phone}: ${e instanceof Error ? e.message : String(e)}`
        console.error(`[lead-sync] Error processing ${errMsg}`)
        errorDetails.push(errMsg)
        errors++
      }

      // Rate limit (Airtable 5 req/sec)
      await new Promise(r => setTimeout(r, 250))
    }

    const result = {
      ok: true,
      checked: oldRecords.length,
      created,
      resubmitted,
      skipped,
      errors,
      ...(isDebug && errorDetails.length > 0 ? { errorDetails } : {}),
      duration: Date.now() - startTime,
    }

    console.log('[lead-sync]', JSON.stringify(result))
    return NextResponse.json(result)

  } catch (e) {
    console.error('[lead-sync] Fatal error:', e)
    await sendTelegram(`<b>[BAS Lead Sync 에러]</b>\n${e instanceof Error ? e.message : String(e)}`)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
