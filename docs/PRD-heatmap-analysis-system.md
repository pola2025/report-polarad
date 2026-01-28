# PRD: 나라똔 히트맵 분석 시스템

**작성일**: 2026-01-29
**상태**: Draft
**프로젝트**: Polarad Meta Dashboard

---

## 1. 개요

### 1.1 목적
나라똔 홈페이지 사용자 행동을 히트맵으로 수집/분석하여 Polarad 대시보드의 GA4 섹션에 통합 표시

### 1.2 프로젝트 구조
```
E:\Naraddon\homepage      → 나라똔 홈페이지 (히트맵 수집 스크립트 설치)
F:\pola_lead              → 히트맵 데이터 수집/처리 서버
F:\polarad-meta           → 대시보드 (GA4 섹션에 히트맵 결과 표시)
```

---

## 2. 요구사항

### 2.1 기능 요구사항

#### Phase 1: 데이터 수집 (나라똔 홈페이지)
- [ ] 클릭 이벤트 수집 (x, y 좌표, 클릭 요소)
- [ ] 스크롤 깊이 추적 (25%, 50%, 75%, 100%)
- [ ] 마우스 이동 경로 (선택적)
- [ ] 영역별 체류 시간
- [ ] 페이지별 수집 (메인, 상담신청 등)

#### Phase 2: 데이터 저장/처리 (pola_lead)
- [ ] 히트맵 데이터 수신 API 엔드포인트
- [ ] 데이터 저장소 구축 (Supabase 또는 파일)
- [ ] 일별/주별 집계 처리
- [ ] 데이터 조회 API

#### Phase 3: 시각화 (polarad-meta)
- [ ] GA4 섹션에 히트맵 탭 추가
- [ ] 클릭 히트맵 시각화
- [ ] 스크롤 깊이 차트
- [ ] 영역별 관심도 분석

### 2.2 비기능 요구사항
- 수집 스크립트는 페이지 성능에 영향 최소화 (비동기 처리)
- 개인정보 미수집 (좌표 데이터만)
- 일일 데이터 보관 기간: 90일

---

## 3. 기술 스택

### 3.1 수집 스크립트
- 순수 JavaScript (의존성 없음)
- 배치 전송 (5초 또는 페이지 이탈 시)

### 3.2 데이터 저장
- **옵션 A**: Supabase (polarad 프로젝트 재사용)
- **옵션 B**: 파일 기반 (JSON/CSV)
- **옵션 C**: Airtable (기존 인프라 활용)

### 3.3 시각화
- React + Recharts (기존 대시보드 스택)
- Canvas 기반 히트맵 렌더링

---

## 4. 데이터 스키마

### 4.1 클릭 이벤트
```typescript
interface ClickEvent {
  id: string
  timestamp: string
  page_url: string
  page_path: string
  x: number          // 클릭 X 좌표 (%)
  y: number          // 클릭 Y 좌표 (px from top)
  element_tag: string
  element_class?: string
  element_text?: string
  viewport_width: number
  viewport_height: number
  session_id: string
}
```

### 4.2 스크롤 이벤트
```typescript
interface ScrollEvent {
  id: string
  timestamp: string
  page_url: string
  page_path: string
  max_scroll_depth: number  // 0-100%
  time_on_page: number      // seconds
  session_id: string
}
```

### 4.3 집계 데이터
```typescript
interface HeatmapAggregate {
  date: string
  page_path: string
  total_clicks: number
  click_zones: {
    zone_id: string    // 영역 식별자
    x_start: number
    x_end: number
    y_start: number
    y_end: number
    click_count: number
  }[]
  avg_scroll_depth: number
  avg_time_on_page: number
}
```

---

## 5. API 설계

### 5.1 데이터 수집 API (pola_lead)
```
POST /api/heatmap/collect
Body: { events: ClickEvent[] | ScrollEvent[] }
Response: { success: boolean }
```

### 5.2 데이터 조회 API (polarad-meta)
```
GET /api/heatmap?page=/&startDate=2026-01-01&endDate=2026-01-29
Response: {
  clicks: ClickEvent[],
  scrollDepth: { depth: number, count: number }[],
  hotZones: { zone: string, clicks: number }[]
}
```

---

## 6. 구현 단계

### Phase 1: 수집 스크립트 (1-2일)
1. 나라똔 홈페이지 기술 스택 확인
2. 히트맵 수집 스크립트 개발
3. 홈페이지에 스크립트 설치

### Phase 2: 백엔드 (1-2일)
1. pola_lead에 수집 API 추가
2. 데이터 저장소 설정
3. 집계 처리 로직

### Phase 3: 대시보드 (2-3일)
1. 히트맵 조회 API 추가
2. GA4 섹션에 히트맵 탭 추가
3. 시각화 컴포넌트 개발

---

## 7. 확인 필요 사항

- [ ] 나라똔 홈페이지 기술 스택 (Next.js? React? HTML?)
- [ ] 데이터 저장소 선택 (Supabase / Airtable / 파일)
- [ ] 우선 수집할 히트맵 지표 선정
- [ ] 시각화 우선순위 (클릭맵 / 스크롤 / 체류시간)

---

## 8. 참고 자료

- 기존 오픈소스 히트맵: [heatmap.js](https://www.patrick-wied.at/static/heatmapjs/)
- GA4 대시보드 위치: `F:\polarad-meta\dashboard\src\components\ga4\`
- pola_lead 위치: `F:\pola_lead`
