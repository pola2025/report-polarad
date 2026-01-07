# 나라똔 마케팅 퍼널 분석 기능 설계서

## 1. 개요

### 목적
GA4 유입/방문 데이터, 홈페이지 접수 데이터, 광고 리드 데이터의 **상관관계를 분석**하여 마케팅 활동 효과를 평가

### 퍼널 흐름
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   유입      │ →  │   방문      │ →  │ 홈페이지    │ →  │  광고 리드  │
│   (GA4)     │    │  세션(GA4)  │    │   접수      │    │   (Meta)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
   totalUsers       sessions         form_submit         leads
```

### 적용 범위
- 클라이언트: **나라똔만** 적용
- 표시 위치: GA4 전용 탭 + 통합 대시보드 KPI

---

## 2. 데이터 소스 및 연동

### 2.1 현재 상태

| 데이터 소스 | 상태 | 데이터 |
|------------|------|--------|
| GA4 유입/방문 | ✅ 완료 | sessions, users, pageviews |
| GA4 전환 이벤트 | ❌ 미설정 | form_submit 등 |
| Meta 광고 리드 | ✅ 완료 | leads (Airtable 저장) |
| 홈페이지 접수 | ❌ 없음 | GA4 이벤트로 설정 필요 |

### 2.2 필요 작업

#### A. GA4 폼 제출 이벤트 설정
나라똔 웹사이트에 아래 이벤트 추적 코드 설치 필요:

```html
<!-- 폼 제출 이벤트 (모든 폼에 공통 적용) -->
<script>
// 방법 1: GTM 없이 직접 구현
document.querySelectorAll('form').forEach(form => {
  form.addEventListener('submit', function(e) {
    gtag('event', 'form_submit', {
      'form_name': this.getAttribute('name') || 'contact_form',
      'form_id': this.getAttribute('id') || 'unknown',
      'page_path': window.location.pathname
    });
  });
});

// 방법 2: 특정 폼에만 적용
document.getElementById('contact-form').addEventListener('submit', function() {
  gtag('event', 'generate_lead', {
    'currency': 'KRW',
    'value': 0,
    'event_category': 'form',
    'event_label': 'contact_inquiry'
  });
});
</script>
```

**권장 이벤트:**
- `generate_lead`: GA4 권장 이벤트 (자동 보고서 지원)
- `form_submit`: 커스텀 이벤트 (상세 추적용)

#### B. GA4 전환 설정
GA4 어드민에서 해당 이벤트를 "전환"으로 마크해야 합니다:
1. GA4 관리 → 이벤트 → 기존 이벤트에서 `generate_lead` 또는 `form_submit` 찾기
2. "전환으로 표시" 토글 활성화

---

## 3. 데이터 저장 구조

### 3.1 Airtable 스키마 설계

**테이블명**: `ga4_conversions` (새로 생성)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| date | Date | 날짜 (YYYY-MM-DD) |
| event_name | Single line text | 이벤트명 (form_submit, generate_lead) |
| event_count | Number | 이벤트 발생 횟수 |
| sessions | Number | 해당 일자 세션 수 |
| users | Number | 해당 일자 사용자 수 |
| source_medium | Single line text | 유입 소스/매체 |
| synced_at | DateTime | 동기화 시간 |

**Base**: 나라똔 기존 Base 사용 (`appN2KzUoORRrb8X9`)

### 3.2 캐시 전략

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    GA4      │ →   │  Airtable   │ →   │ API 응답    │
│  (원본)     │     │  (캐시)     │     │ (클라이언트)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
   실시간 조회        일 1회 동기화          조회 시 캐시 우선
```

**동기화 로직:**
1. 매일 새벽 자동 동기화 (Vercel Cron)
2. 수동 동기화 버튼 제공
3. 캐시 유효기간: 24시간
4. 캐시 미스 시 → GA4 직접 조회 → Airtable 저장

---

## 4. API 설계

### 4.1 GA4 전환 이벤트 조회 API (신규)

**엔드포인트**: `GET /api/ga4/events`

**쿼리 파라미터:**
- `clientSlug`: 클라이언트 slug (naratton)
- `startDate`: 시작일 (YYYY-MM-DD)
- `endDate`: 종료일 (YYYY-MM-DD)
- `eventName`: 이벤트명 (form_submit, generate_lead)

**응답:**
```json
{
  "success": true,
  "data": {
    "daily": [
      {
        "date": "2025-01-01",
        "event_name": "generate_lead",
        "event_count": 5,
        "sessions": 120,
        "users": 95
      }
    ],
    "total": {
      "event_count": 150,
      "sessions": 3600,
      "users": 2800,
      "conversion_rate": 4.17
    },
    "bySource": [
      {
        "source_medium": "google / cpc",
        "event_count": 80,
        "sessions": 1500,
        "conversion_rate": 5.33
      }
    ]
  }
}
```

### 4.2 퍼널 분석 API (신규)

**엔드포인트**: `GET /api/funnel/analysis`

**쿼리 파라미터:**
- `clientSlug`: 클라이언트 slug (naratton)
- `startDate`: 시작일
- `endDate`: 종료일
- `granularity`: daily | weekly | monthly

**응답:**
```json
{
  "success": true,
  "data": {
    "funnel": {
      "stages": [
        { "name": "유입", "metric": "users", "value": 2800, "rate": 100 },
        { "name": "방문", "metric": "sessions", "value": 3600, "rate": 128.6 },
        { "name": "접수", "metric": "form_submit", "value": 150, "rate": 5.36 },
        { "name": "리드", "metric": "meta_leads", "value": 85, "rate": 3.04 }
      ],
      "conversionRates": {
        "visitToSubmit": 4.17,
        "submitToLead": 56.67,
        "overallConversion": 3.04
      }
    },
    "trend": {
      "daily": [
        {
          "date": "2025-01-01",
          "users": 95,
          "sessions": 120,
          "submissions": 5,
          "leads": 3
        }
      ]
    },
    "correlation": {
      "sessions_vs_submissions": 0.85,
      "submissions_vs_leads": 0.72,
      "spend_vs_leads": 0.91
    },
    "byChannel": [
      {
        "channel": "Meta",
        "users": 1200,
        "submissions": 70,
        "leads": 60,
        "spend": 500000,
        "cpl": 8333
      },
      {
        "channel": "Organic",
        "users": 800,
        "submissions": 50,
        "leads": 0,
        "spend": 0,
        "cpl": null
      }
    ]
  }
}
```

### 4.3 동기화 API (기존 확장)

**엔드포인트**: `POST /api/ga4/sync`

**기존 기능 + 전환 이벤트 동기화 추가:**
- 세션/사용자 데이터 동기화
- **전환 이벤트 데이터 동기화** (신규)

---

## 5. 프론트엔드 컴포넌트 설계

### 5.1 퍼널 시각화 컴포넌트

**파일**: `dashboard/src/components/funnel/FunnelChart.tsx`

```tsx
interface FunnelStage {
  name: string;
  value: number;
  rate: number;
  color: string;
}

// Recharts FunnelChart 또는 커스텀 SVG
// 각 단계별 폭이 value에 비례
// 단계 간 전환율 표시
```

**시각화 형태:**
```
     ┌────────────────────────────────────┐
     │         유입 (2,800명)             │  100%
     └──────────────────────────────────┬─┘
           └──────────────────────────┬─┘
             │    세션 (3,600회)      │     128.6%
             └──────────────────────┬─┘
               └────────────────────┬─┘
                 │  접수 (150건)    │       5.36%
                 └───────────────┬──┘
                   │ 리드 (85건) │          3.04%
                   └─────────────┘
```

### 5.2 상관관계 분석 컴포넌트

**파일**: `dashboard/src/components/funnel/CorrelationChart.tsx`

```tsx
// 산점도 + 회귀선
// X축: 세션 수 또는 광고비
// Y축: 접수 수 또는 리드 수
// R² 값 표시
```

### 5.3 채널별 성과 비교

**파일**: `dashboard/src/components/funnel/ChannelComparison.tsx`

```tsx
// 테이블 또는 바 차트
// 채널: Meta, Naver, Organic, Direct 등
// 지표: 유입, 접수, 리드, CPL, ROAS
```

### 5.4 GA4 섹션 확장

**파일**: `dashboard/src/components/ga4/GA4Section.tsx` (기존 확장)

추가할 탭:
- **퍼널 분석**: FunnelChart + 전환율
- **상관관계**: CorrelationChart
- **채널 비교**: ChannelComparison

### 5.5 대시보드 KPI 추가

**파일**: `dashboard/src/app/page.tsx` (기존 확장)

KPI 카드 추가:
- 홈페이지 접수 (form_submit)
- 방문→접수 전환율
- 접수→리드 전환율
- 전체 전환율

---

## 6. 구현 계획

### Phase 1: GA4 이벤트 설정 (1일)
1. [ ] 나라똔 웹사이트에 폼 제출 이벤트 코드 추가
2. [ ] GA4 어드민에서 전환 설정
3. [ ] 이벤트 발생 테스트

### Phase 2: 데이터 수집 (2일)
1. [ ] Airtable ga4_conversions 테이블 생성
2. [ ] GA4 이벤트 조회 API 구현 (`/api/ga4/events`)
3. [ ] 동기화 API 확장 (`/api/ga4/sync`)
4. [ ] 테스트 데이터로 검증

### Phase 3: 퍼널 분석 API (2일)
1. [ ] 퍼널 분석 API 구현 (`/api/funnel/analysis`)
2. [ ] Meta 리드 데이터와 조인
3. [ ] 상관관계 계산 로직
4. [ ] 채널별 분류 로직

### Phase 4: 프론트엔드 (3일)
1. [ ] FunnelChart 컴포넌트
2. [ ] CorrelationChart 컴포넌트
3. [ ] ChannelComparison 컴포넌트
4. [ ] GA4Section 확장
5. [ ] 대시보드 KPI 추가

### Phase 5: 테스트 및 배포 (1일)
1. [ ] 로컬 테스트
2. [ ] Vercel 배포
3. [ ] 프로덕션 검증

---

## 7. 기술 스택

- **백엔드**: Next.js API Routes
- **데이터 저장**: Airtable
- **데이터 소스**: GA4 Data API, Meta Marketing API
- **차트**: Recharts (기존 사용 중)
- **스타일링**: Tailwind CSS

---

## 8. 의존성

### GA4 이벤트 설정 선행 필요
퍼널 분석 기능은 **GA4 폼 제출 이벤트**가 설정되어야 정상 작동합니다.

이벤트 설정 전까지:
- 퍼널에서 "접수" 단계는 0으로 표시
- 또는 "데이터 수집 중" 메시지 표시

### 데이터 수집 기간
이벤트 설정 후 **최소 7일**의 데이터가 쌓여야 의미있는 분석 가능

---

## 9. 추가 고려사항

### 9.1 데이터 정합성
- GA4 세션과 Meta 리드의 날짜가 UTC vs KST로 다를 수 있음
- 시간대 통일 필요 (KST 기준)

### 9.2 채널 매핑
GA4 source/medium을 광고 채널로 매핑:
- `facebook / cpc` → Meta
- `instagram / cpc` → Meta
- `naver / cpc` → Naver
- `google / organic` → Organic
- `(direct) / (none)` → Direct

### 9.3 상관관계 계산
피어슨 상관계수 사용:
```javascript
function pearsonCorrelation(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}
```

---

## 10. 결론

이 설계를 통해 나라똔의 마케팅 퍼널 전체를 추적하고 분석할 수 있습니다:

1. **유입 분석**: GA4 사용자/세션 데이터
2. **전환 추적**: GA4 폼 제출 이벤트 → Airtable 캐시
3. **리드 분석**: Meta 광고 리드 데이터
4. **상관관계**: 광고비 ↔ 유입 ↔ 접수 ↔ 리드 간의 관계 분석
5. **채널 비교**: 채널별 전환율 및 ROI 비교

**다음 단계**: 사용자 확인 후 Phase 1 (GA4 이벤트 설정)부터 시작
