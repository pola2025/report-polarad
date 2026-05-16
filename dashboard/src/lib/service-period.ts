export const SERVICE_DURATION_MONTH_OPTIONS = [3, 6] as const

export type ServiceDurationMonths = (typeof SERVICE_DURATION_MONTH_OPTIONS)[number]

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function formatDate(year: number, monthIndex: number, day: number) {
  return [
    String(year).padStart(4, '0'),
    String(monthIndex + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function normalizeServiceDurationMonths(value: unknown): ServiceDurationMonths {
  const numericValue = typeof value === 'string' ? Number(value) : value
  return numericValue === 6 ? 6 : 3
}

export function calculateServiceEndDate(startDate: string, durationMonths: unknown) {
  if (!DATE_PATTERN.test(startDate)) return ''

  const [year, month, day] = startDate.split('-').map(Number)
  const monthIndex = month - 1
  const startDateValue = new Date(Date.UTC(year, monthIndex, day))

  if (
    startDateValue.getUTCFullYear() !== year ||
    startDateValue.getUTCMonth() !== monthIndex ||
    startDateValue.getUTCDate() !== day
  ) {
    return ''
  }

  const months = normalizeServiceDurationMonths(durationMonths)
  const targetMonthDate = new Date(Date.UTC(year, monthIndex + months, 1))
  const targetYear = targetMonthDate.getUTCFullYear()
  const targetMonthIndex = targetMonthDate.getUTCMonth()
  const targetMonthDays = getDaysInMonth(targetYear, targetMonthIndex)

  if (day > targetMonthDays) {
    return formatDate(targetYear, targetMonthIndex, targetMonthDays)
  }

  const exclusiveEndDate = new Date(Date.UTC(targetYear, targetMonthIndex, day))
  exclusiveEndDate.setUTCDate(exclusiveEndDate.getUTCDate() - 1)

  return formatDate(
    exclusiveEndDate.getUTCFullYear(),
    exclusiveEndDate.getUTCMonth(),
    exclusiveEndDate.getUTCDate()
  )
}

export function inferServiceDurationMonths(
  startDate: string,
  endDate: string | null | undefined
): ServiceDurationMonths {
  const matchedDuration = SERVICE_DURATION_MONTH_OPTIONS.find(
    (months) => calculateServiceEndDate(startDate, months) === endDate
  )

  return matchedDuration ?? 3
}
