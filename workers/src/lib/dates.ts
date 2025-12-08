import type { DateRange } from '../types'

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 어제 날짜 (데이터 수집 기준일)
 */
export function getYesterday(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return formatDate(date)
}

/**
 * N일 전 날짜
 */
export function getDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDate(date)
}

/**
 * 이번 주 날짜 범위 (월요일 ~ 일요일)
 */
export function getThisWeekRange(): DateRange {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  }
}

/**
 * 지난 주 날짜 범위
 */
export function getLastWeekRange(): DateRange {
  const thisWeek = getThisWeekRange()
  const lastMonday = new Date(thisWeek.start)
  lastMonday.setDate(lastMonday.getDate() - 7)

  const lastSunday = new Date(thisWeek.start)
  lastSunday.setDate(lastSunday.getDate() - 1)

  return {
    start: formatDate(lastMonday),
    end: formatDate(lastSunday),
  }
}

/**
 * 일별 데이터 수집 기간 (어제 하루)
 */
export function getDailyCollectionRange(): DateRange {
  const yesterday = getYesterday()
  return {
    start: yesterday,
    end: yesterday,
  }
}
