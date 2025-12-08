# PRD: 통합 광고 분석 대시보드

## 1. 개요

### 1.1 목적
현재 분리된 네이버/Meta 광고 분석을 통합하여 관리자와 클라이언트 모두가 전체 광고 성과를 한눈에 파악할 수 있는 대시보드 구축

### 1.2 현재 상태
- `/admin/naver`: 네이버 플레이스 광고 분석 (관리자 전용)
- `/` (메인): Meta + 네이버 기본 KPI 표시 (클라이언트/관리자)
- Meta 광고비: USD 원본만 표시 (환율 변환 없음)

### 1.3 목표 상태
- **통합 분석 대시보드**: Meta + 네이버 데이터를 하나의 화면에서 분석
- **클라이언트 접근 가능**: 클라이언트도 상세 분석 페이지 접근 가능
- **환율 적용**: Meta 광고비 USD → KRW 환산 표시 (1,500원 고정 환율)

---

## 2. 기능 요구사항

### 2.1 환율 적용 (Meta 광고비)

#### 표시 형식
```
Meta 광고비: $150.00 (₩225,000)
```

#### 적용 범위
- 모든 Meta 광고비 표시 위치
- KPI 카드, 테이블, 차트 등

#### 환율 설정
```typescript
const USD_TO_KRW_RATE = 1500 // 고정 환율
```

### 2.2 통합 분석 대시보드 (신규)

#### 2.2.1 접근 경로
- 관리자: `/admin/analytics` (기존 `/admin/naver` 확장)
- 클라이언트: `/?client=slug` 또는 `/analytics?client=slug`

#### 2.2.2 탭 구조
```
[통합 요약] [Meta 상세] [네이버 상세] [채널 비교]
```

#### 2.2.3 통합 요약 탭

**KPI 카드 (8개)**
| 지표 | 설명 |
|------|------|
| 총 광고비 | Meta(KRW환산) + 네이버 합계 |
| 총 노출수 | Meta + 네이버 합계 |
| 총 클릭수 | Meta + 네이버 합계 |
| 평균 CTR | 전체 클릭/전체 노출 |
| 평균 CPC | 전체 비용/전체 클릭 |
| Meta 리드 | Meta 전환 수 |
| Meta CPL | Meta 비용/리드 |
| 네이버 평균순위 | 네이버 광고 평균 순위 |

**채널별 비용 비중 차트**
- 도넛 차트: Meta vs 네이버 비용 비중
- 범례: 채널명 + 금액 + 비율

**일별 통합 트렌드**
- 라인 차트: 일별 총 비용 (Meta+네이버)
- 스택 바 차트: 채널별 비용 분해

#### 2.2.4 Meta 상세 탭

**KPI 카드**
- 총 지출: $XXX (₩XXX,XXX)
- 노출수, 클릭수, CTR
- 리드수, CPL
- 비디오 조회수 (있는 경우)

**일별 테이블**
| 날짜 | 노출 | 클릭 | CTR | 지출($) | 지출(₩) | 리드 | CPL |

**캠페인별 분석** (선택)
| 캠페인 | 노출 | 클릭 | 지출 | 리드 |

#### 2.2.5 네이버 상세 탭
- 기존 `/admin/naver` 기능 그대로 유지
- 기간별 테이블 (일/주/월)
- 키워드별 분석

#### 2.2.6 채널 비교 탭

**비교 테이블**
| 지표 | Meta | 네이버 | 차이 |
|------|------|--------|------|
| 광고비 | ₩XXX | ₩XXX | +XX% |
| 노출수 | XXX | XXX | -XX% |
| 클릭수 | XXX | XXX | +XX% |
| CTR | X.XX% | X.XX% | - |
| CPC | ₩XXX | ₩XXX | - |

**효율성 분석**
- 채널별 CPC 비교 바 차트
- 채널별 CTR 비교 바 차트

---

## 3. 데이터 구조

### 3.1 API 엔드포인트

#### 기존 API 수정
```
GET /api/dashboard
  - Meta spend 응답에 spend_krw 필드 추가
  - Response:
    {
      meta: {
        current: {
          spend: 150.00,        // USD (기존)
          spend_krw: 225000,    // KRW (신규)
          ...
        }
      }
    }
```

#### 신규 API
```
GET /api/analytics/integrated
  Query: clientId, startDate, endDate
  Response:
    {
      summary: {
        total_spend_krw: number,
        total_impressions: number,
        total_clicks: number,
        avg_ctr: number,
        avg_cpc_krw: number,
        meta_spend_usd: number,
        meta_spend_krw: number,
        naver_spend_krw: number,
        channel_ratio: { meta: number, naver: number }
      },
      meta: { ... },
      naver: { ... },
      daily_combined: [
        {
          date: string,
          meta_spend_usd: number,
          meta_spend_krw: number,
          naver_spend: number,
          total_spend_krw: number,
          ...
        }
      ]
    }
```

### 3.2 타입 정의

```typescript
// types/integrated-analytics.ts

export interface IntegratedSummary {
  total_spend_krw: number
  total_impressions: number
  total_clicks: number
  avg_ctr: number
  avg_cpc_krw: number

  meta_spend_usd: number
  meta_spend_krw: number
  meta_leads: number
  meta_cpl_krw: number

  naver_spend_krw: number
  naver_avg_rank: number

  channel_ratio: {
    meta_percent: number
    naver_percent: number
  }
}

export interface DailyCombinedData {
  date: string
  meta_impressions: number
  meta_clicks: number
  meta_spend_usd: number
  meta_spend_krw: number
  meta_leads: number
  naver_impressions: number
  naver_clicks: number
  naver_spend: number
  total_impressions: number
  total_clicks: number
  total_spend_krw: number
}

export interface IntegratedAnalyticsResponse {
  summary: IntegratedSummary
  meta: MetaDetailedData
  naver: NaverPeriodDataResponse
  daily_combined: DailyCombinedData[]
  period: {
    start: string
    end: string
  }
}
```

---

## 4. UI/UX 설계

### 4.1 관리자 대시보드 (/admin/analytics)

```
┌─────────────────────────────────────────────────────────────┐
│ ← 뒤로   통합 광고 분석                    [새로고침] [Excel] │
├─────────────────────────────────────────────────────────────┤
│ 클라이언트: [선택 v]  시작일: [____]  종료일: [____]  [7일][30일][90일] │
├─────────────────────────────────────────────────────────────┤
│ [통합 요약] [Meta 상세] [네이버 상세] [채널 비교]           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 총 광고비 │ │ 총 노출수 │ │ 총 클릭수 │ │ 평균 CTR  │       │
│  │₩1,234,567│ │ 123,456  │ │  12,345  │ │  10.0%   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  ┌─────────────────────┐ ┌─────────────────────────────┐   │
│  │    채널별 비용 비중   │ │      일별 통합 트렌드        │   │
│  │    [도넛 차트]       │ │      [스택 바 차트]          │   │
│  │  Meta 60% / 네이버 40%│ │                             │   │
│  └─────────────────────┘ └─────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 클라이언트 대시보드 (메인 페이지 확장)

```
┌─────────────────────────────────────────────────────────────┐
│ [Polarad Logo]  Polarad Report    [기간 선택 v] [H.E.A 판교] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 총 광고비 │ │ 총 클릭수 │ │ Meta 리드 │ │ 평균 CPC │       │
│  │₩1,234,567│ │  12,345  │ │    123   │ │ ₩1,234  │       │
│  │ +12.3%   │ │  +5.2%   │ │  +8.1%   │ │  -3.2%  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  [상세 분석 보기 →]                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           채널별 성과 비교 (Meta vs 네이버)            │   │
│  │  [노출수 v]                                          │   │
│  │           [라인 차트 - 일별 추이]                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────┐ ┌────────────────────────┐     │
│  │      Meta 광고 성과      │ │   네이버 플레이스 성과   │     │
│  │ 지출: $150 (₩225,000)   │ │ 지출: ₩300,000          │     │
│  │ 노출: 50,000 / 클릭: 500 │ │ 노출: 30,000 / 클릭: 600│     │
│  │ CTR: 1.0% / CPL: $15    │ │ CTR: 2.0% / CPC: ₩500  │     │
│  └────────────────────────┘ └────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 광고비 표시 컴포넌트

```tsx
// 예시 컴포넌트
<SpendDisplay
  usd={150.00}
  krw={225000}
  showBoth={true}
/>

// 출력: $150.00 (₩225,000)
```

---

## 5. 구현 계획

### Phase 1: 환율 적용 (1일)
1. `USD_TO_KRW_RATE` 상수 정의
2. `/api/dashboard` 응답에 `spend_krw` 추가
3. 기존 UI에서 USD + KRW 동시 표시

### Phase 2: 통합 분석 API (1일)
1. `/api/analytics/integrated` 신규 API 구현
2. 타입 정의 (`types/integrated-analytics.ts`)
3. Meta + 네이버 데이터 통합 로직

### Phase 3: 관리자 통합 대시보드 (2일)
1. `/admin/analytics` 페이지 생성
2. 탭 UI 구현 (통합요약/Meta/네이버/비교)
3. 통합 차트 컴포넌트 구현
4. 기존 `/admin/naver` → `/admin/analytics`로 리다이렉트

### Phase 4: 클라이언트 대시보드 확장 (1일)
1. 메인 페이지 KPI 카드 환율 적용
2. "상세 분석 보기" 버튼 추가
3. 클라이언트용 분석 페이지 접근 권한 설정

### Phase 5: 테스트 및 배포 (0.5일)
1. 빌드 테스트
2. 데이터 검증
3. 배포

---

## 6. 파일 구조 (예상)

```
dashboard/src/
├── app/
│   ├── admin/
│   │   ├── analytics/          # 신규: 통합 분석 (관리자)
│   │   │   └── page.tsx
│   │   └── naver/              # 기존 유지 (리다이렉트)
│   │       └── page.tsx
│   └── api/
│       └── analytics/
│           └── integrated/
│               └── route.ts    # 신규: 통합 분석 API
├── components/
│   ├── analytics/              # 신규: 분석 컴포넌트
│   │   ├── IntegratedSummary.tsx
│   │   ├── ChannelComparison.tsx
│   │   ├── SpendDisplay.tsx    # USD/KRW 표시
│   │   └── CombinedTrendChart.tsx
│   └── naver/                  # 기존 유지
├── lib/
│   └── constants.ts            # USD_TO_KRW_RATE 등
└── types/
    └── integrated-analytics.ts # 신규: 통합 분석 타입
```

---

## 7. 비기능 요구사항

### 7.1 성능
- 대시보드 초기 로딩: 2초 이내
- 기간 변경 시 데이터 갱신: 1초 이내

### 7.2 호환성
- 기존 클라이언트 URL 유지 (`/?client=slug`)
- 기존 관리자 기능 유지

### 7.3 접근성
- 모든 숫자에 천단위 구분자 적용
- 색상 대비 WCAG AA 준수

---

## 8. 승인

- [ ] 기획 승인
- [ ] 개발 착수
- [ ] Phase 1 완료
- [ ] Phase 2 완료
- [ ] Phase 3 완료
- [ ] Phase 4 완료
- [ ] 최종 검수 및 배포

---

**작성일**: 2025-12-08
**작성자**: Claude (AI Assistant)
**버전**: 1.0
