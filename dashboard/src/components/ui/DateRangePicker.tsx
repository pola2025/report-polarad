'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onDateChange: (start: string, end: string) => void
  presets?: Array<{
    label: string
    value: string
    getRange: () => { start: string; end: string }
  }>
}

const defaultPresets = [
  {
    label: '최근 7일',
    value: '7d',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(end.getDate() - 6)
      return {
        start: formatDate(start),
        end: formatDate(end),
      }
    },
  },
  {
    label: '최근 30일',
    value: '30d',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(end.getDate() - 29)
      return {
        start: formatDate(start),
        end: formatDate(end),
      }
    },
  },
  {
    label: '이번 달',
    value: 'thisMonth',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = now
      return {
        start: formatDate(start),
        end: formatDate(end),
      }
    },
  },
  {
    label: '지난 달',
    value: 'lastMonth',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        start: formatDate(start),
        end: formatDate(end),
      }
    },
  },
  {
    label: '최근 3개월',
    value: '3m',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setMonth(end.getMonth() - 3)
      start.setDate(start.getDate() + 1)
      return {
        start: formatDate(start),
        end: formatDate(end),
      }
    },
  },
]

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // 이전 달의 날짜들 (월요일 시작)
  const startDayOfWeek = firstDay.getDay() || 7 // 일요일을 7로
  for (let i = startDayOfWeek - 1; i > 0; i--) {
    const d = new Date(year, month, 1 - i)
    days.push(d)
  }

  // 현재 달의 날짜들
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // 다음 달의 날짜들
  const remainingDays = 42 - days.length // 6주 표시
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
]

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']

export function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  presets = defaultPresets,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selecting, setSelecting] = useState<'start' | 'end'>('start')
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseDate(startDate)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const containerRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getRange()
    setTempStart(range.start)
    setTempEnd(range.end)
    onDateChange(range.start, range.end)
    setIsOpen(false)
  }

  const handleDayClick = (date: Date) => {
    const dateStr = formatDate(date)

    if (selecting === 'start') {
      setTempStart(dateStr)
      if (dateStr > tempEnd) {
        setTempEnd(dateStr)
      }
      setSelecting('end')
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr)
        setTempEnd(dateStr)
        setSelecting('end')
      } else {
        setTempEnd(dateStr)
        setSelecting('start')
      }
    }
  }

  const handleApply = () => {
    onDateChange(tempStart, tempEnd)
    setIsOpen(false)
  }

  const goToPrevMonth = () => {
    setViewMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 }
      }
      return { year: prev.year, month: prev.month - 1 }
    })
  }

  const goToNextMonth = () => {
    setViewMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 }
      }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  const days = getMonthDays(viewMonth.year, viewMonth.month)

  const isInRange = (date: Date) => {
    const dateStr = formatDate(date)
    return dateStr >= tempStart && dateStr <= tempEnd
  }

  const isStart = (date: Date) => formatDate(date) === tempStart
  const isEnd = (date: Date) => formatDate(date) === tempEnd
  const isCurrentMonth = (date: Date) => date.getMonth() === viewMonth.month
  const isToday = (date: Date) => formatDate(date) === formatDate(new Date())

  const displayLabel = `${startDate} ~ ${endDate}`

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium bg-white/20 text-white px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
      >
        <Calendar className="h-4 w-4" />
        <span>{displayLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[400px]">
          <div className="flex">
            {/* 프리셋 */}
            <div className="w-32 border-r border-gray-200 p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">빠른 선택</div>
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset)}
                  className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* 캘린더 */}
            <div className="p-4 flex-1">
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPrevMonth}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <span className="font-medium text-gray-900">
                  {viewMonth.year}년 {MONTH_NAMES[viewMonth.month]}
                </span>
                <button
                  onClick={goToNextMonth}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_NAMES.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-gray-500 py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((date, i) => {
                  const inRange = isInRange(date)
                  const start = isStart(date)
                  const end = isEnd(date)
                  const currentMonth = isCurrentMonth(date)
                  const today = isToday(date)

                  return (
                    <button
                      key={i}
                      onClick={() => handleDayClick(date)}
                      className={`
                        relative h-8 text-sm rounded
                        ${!currentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${inRange && !start && !end ? 'bg-orange-100' : ''}
                        ${start || end ? 'bg-[#F5A623] text-white' : ''}
                        ${today && !start && !end ? 'border border-[#F5A623]' : ''}
                        ${currentMonth && !inRange ? 'hover:bg-gray-100' : ''}
                      `}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>

              {/* 선택된 범위 표시 및 적용 버튼 */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className={selecting === 'start' ? 'font-bold text-[#F5A623]' : ''}>
                    {tempStart}
                  </span>
                  <span className="mx-2">~</span>
                  <span className={selecting === 'end' ? 'font-bold text-[#F5A623]' : ''}>
                    {tempEnd}
                  </span>
                </div>
                <button
                  onClick={handleApply}
                  className="px-4 py-1.5 bg-[#F5A623] text-white text-sm font-medium rounded hover:bg-[#E09000] transition-colors"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
