# PRD: 네이버 브랜드검색 데이터 시스템

## 문서 정보

- **버전**: 1.0.0
- **작성일**: 2026-01-05
- **상태**: Draft

---

## 1. 개요

### 1.1 목적

네이버 브랜드검색 광고 데이터를 관리하고 대시보드에 표시하는 시스템 구현.
기존 HEA 판교(place 타입)와 분리된 브랜드검색 전용 데이터 구조 및 UI 제공.

### 1.2 배경

- 나라똔 클라이언트: 경영컨설팅 업종, 네이버 브랜드검색 광고 운영
- 기존 place 타입과 다른 데이터 구조 필요 (키워드별 → PC/모바일별)
- 월 고정 예산 (PC 66만원, 모바일 66만원 = 총 132만원)

### 1.3 범위

| 포함 | 제외 |
|------|------|
| 브랜드검색 데이터 테이블 | 네이버 API 자동 연동 |
| CSV 업로드 기능 | 실시간 데이터 동기화 |
| 대시보드 브랜드검색 섹션 | 네이버 place 타입 변경 |
| Admin 클라이언트 설정 연동 | GA 연동 |

---

## 2. 요구사항

### 2.1 기능 요구사항

#### FR-1: 데이터 저장

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1.1 | 일별 PC/모바일 노출수, 클릭수 저장 | P0 |
| FR-1.2 | 클라이언트별 데이터 분리 | P0 |
| FR-1.3 | 중복 데이터 방지 (날짜+디바이스) | P0 |
| FR-1.4 | 기간별 집계 조회 | P0 |

#### FR-2: CSV 업로드

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-2.1 | 네이버 광고 CSV 파싱 | P0 |
| FR-2.2 | PC/모바일 분리 저장 | P0 |
| FR-2.3 | 업로드 미리보기 | P1 |
| FR-2.4 | 중복 데이터 업데이트 (UPSERT) | P0 |

#### FR-3: 대시보드 표시

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-3.1 | 브랜드검색 KPI 카드 | P0 |
| FR-3.2 | 일별/월별 테이블 뷰 | P0 |
| FR-3.3 | 고정 예산 표시 | P0 |
| FR-3.4 | CTR 자동 계산 | P0 |

#### FR-4: 클라이언트 설정 연동

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-4.1 | naver_type='brand_search' 시 브랜드검색 UI | P0 |
| FR-4.2 | naver_enabled=false 시 광고데이터 숨김 | P0 |
| FR-4.3 | naver_fixed_budget 고정 예산 적용 | P0 |

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | CSV 파싱 속도 | 1000행 < 3초 |
| NFR-2 | API 응답 시간 | < 500ms |
| NFR-3 | 데이터 정합성 | 100% |

---

## 3. 데이터 모델

### 3.1 DB 스키마: `polarad_brand_search_data`

```sql
CREATE TABLE polarad_brand_search_data (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES polarad_clients(id),
  date DATE NOT NULL,
  device VARCHAR(10) NOT NULL, -- 'pc' | 'mobile'
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 복합 유니크 (날짜 + 디바이스)
  CONSTRAINT unique_brand_search_daily UNIQUE (client_id, date, device)
);

-- 인덱스
CREATE INDEX idx_brand_search_client_date
  ON polarad_brand_search_data(client_id, date DESC);

-- RLS 정책
ALTER TABLE polarad_brand_search_data ENABLE ROW LEVEL SECURITY;
```

### 3.2 TypeScript 타입

```typescript
// 브랜드검색 일별 데이터 (DB Row)
interface BrandSearchDataRow {
  id: number;
  client_id: string;
  date: string;
  device: 'pc' | 'mobile';
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

// 브랜드검색 일별 집계 (API Response)
interface BrandSearchDailyData {
  date: string;
  pc_impressions: number;
  pc_clicks: number;
  mobile_impressions: number;
  mobile_clicks: number;
  total_impressions: number;
  total_clicks: number;
  ctr: number; // (total_clicks / total_impressions) * 100
}

// 브랜드검색 월별 집계
interface BrandSearchMonthlyData {
  month: string; // '2025-12'
  month_label: string; // '2025년 12월'
  pc_impressions: number;
  pc_clicks: number;
  mobile_impressions: number;
  mobile_clicks: number;
  total_impressions: number;
  total_clicks: number;
  total_ctr: number;
  days: BrandSearchDailyData[]; // 월 내 일별 데이터
}

// CSV 파싱 결과
interface BrandSearchCSVRow {
  campaign: string;
  date: string; // '2025.12.03.'
  ad_group: string; // '브랜드검색광고_PC' | '브랜드검색광고_모바일'
  impressions: number;
  clicks: number;
}
```

### 3.3 클라이언트 설정값 연결

```typescript
// polarad_clients 테이블 확장 컬럼
interface ClientNaverConfig {
  naver_type: 'place' | 'brand_search';
  naver_enabled: boolean;
  naver_show_keywords: boolean;
  naver_show_detail_tab: boolean;
  naver_fixed_budget: number | null; // 월 고정 예산 (원)
}

// 설정값에 따른 UI 동작
const UI_BEHAVIOR = {
  // naver_type = 'brand_search' 일 때
  brand_search: {
    show_brand_search_table: true,    // BrandSearchTable 표시
    show_keyword_table: false,        // NaverKeywordTable 숨김
    show_naver_kpi: false,            // 네이버 광고 KPI 숨김 (naver_enabled 따름)
    budget_display: 'fixed',          // 고정 예산 표시
  },

  // naver_type = 'place' 일 때
  place: {
    show_brand_search_table: false,
    show_keyword_table: true,
    show_naver_kpi: true,
    budget_display: 'dynamic',        // 실제 지출 표시
  }
};
```

---

## 4. API 설계

### 4.1 브랜드검색 데이터 조회 API

**Endpoint**: `GET /api/naver/brand-search`

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| clientId | string | ✓ | 클라이언트 UUID |
| startDate | string | ✓ | 시작일 (YYYY-MM-DD) |
| endDate | string | ✓ | 종료일 (YYYY-MM-DD) |

**Response**:
```typescript
interface BrandSearchAPIResponse {
  success: boolean;
  data: {
    daily: BrandSearchDailyData[];
    monthly: BrandSearchMonthlyData[];
    summary: {
      total_impressions: number;
      total_clicks: number;
      total_ctr: number;
      pc_impressions: number;
      pc_clicks: number;
      mobile_impressions: number;
      mobile_clicks: number;
    };
    fixed_budget: {
      pc: number;
      mobile: number;
      total: number;
    };
  };
  error?: string;
}
```

### 4.2 CSV 업로드 API

**Endpoint**: `POST /api/admin/upload/brand-search`

**Request**:
```typescript
interface BrandSearchUploadRequest {
  clientId: string;
  data: Array<{
    date: string;      // 'YYYY-MM-DD'
    device: 'pc' | 'mobile';
    impressions: number;
    clicks: number;
  }>;
}
```

**Response**:
```typescript
interface BrandSearchUploadResponse {
  success: boolean;
  inserted: number;
  updated: number;
  errors: string[];
}
```

---

## 5. 프론트엔드 구현

### 5.1 컴포넌트 구조

```
components/
├── naver/
│   ├── BrandSearchTable.tsx     # 기존 (PC/모바일 테이블)
│   ├── BrandSearchKPI.tsx       # 새로 추가 (요약 KPI 카드)
│   └── BrandSearchChart.tsx     # 새로 추가 (트렌드 차트)
└── admin/
    └── BrandSearchUpload.tsx    # CSV 업로드 UI
```

### 5.2 조건부 렌더링 로직

```typescript
// page.tsx 내 조건부 렌더링
function DashboardContent() {
  const { clientInfo } = useClientInfo();

  // 네이버 섹션 렌더링
  const renderNaverSection = () => {
    if (!clientInfo) return null;

    // naver_type에 따른 분기
    if (clientInfo.naver.type === 'brand_search') {
      return (
        <>
          {/* 브랜드검색 테이블 */}
          <BrandSearchTable
            clientId={clientInfo.id}
            monthlyBudget={{
              pc: 660000,
              mobile: 660000
            }}
          />
        </>
      );
    }

    // place 타입: 기존 키워드 테이블
    if (clientInfo.naver.enabled) {
      return <NaverKeywordTable clientId={clientInfo.id} />;
    }

    return null;
  };

  return (
    <div>
      {/* KPI 섹션 */}
      {clientInfo?.naver.enabled && <NaverKPISection />}

      {/* 네이버 상세 탭 */}
      {clientInfo?.naver.show_detail_tab && renderNaverSection()}
    </div>
  );
}
```

### 5.3 Admin 클라이언트 등록 폼 연동

```typescript
// Admin 폼에서 naver_type 선택 시 자동 설정
const handleNaverTypeChange = (type: 'place' | 'brand_search') => {
  if (type === 'brand_search') {
    // 브랜드검색 기본 설정
    setFormData({
      ...formData,
      naver_type: 'brand_search',
      naver_enabled: false,          // 광고 데이터 숨김
      naver_show_keywords: false,    // 키워드 테이블 숨김
      naver_show_detail_tab: true,   // 상세 탭은 표시 (브랜드검색 테이블용)
      naver_fixed_budget: 1320000,   // 월 132만원
    });
  } else {
    // place 기본 설정
    setFormData({
      ...formData,
      naver_type: 'place',
      naver_enabled: true,
      naver_show_keywords: true,
      naver_show_detail_tab: true,
      naver_fixed_budget: null,
    });
  }
};
```

---

## 6. CSV 파싱 규칙

### 6.1 입력 형식

네이버 광고 내보내기 CSV:
```csv
캠페인,일별,광고그룹,노출수,클릭수
브랜드검색광고,2025.12.03.,브랜드검색광고_PC,49,31
브랜드검색광고,2025.12.03.,브랜드검색광고_모바일,80,57
브랜드검색광고,2025.12.04.,브랜드검색광고_PC,52,28
브랜드검색광고,2025.12.04.,브랜드검색광고_모바일,75,50
```

### 6.2 파싱 로직

```typescript
function parseBrandSearchCSV(csvText: string): BrandSearchDataRow[] {
  const lines = csvText.split('\n');
  const results: BrandSearchDataRow[] = [];

  // 헤더 스킵
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;

    const [campaign, dateStr, adGroup, impressions, clicks] = cols;

    // 날짜 파싱: '2025.12.03.' → '2025-12-03'
    const date = dateStr.replace(/\./g, '-').slice(0, 10);

    // 디바이스 추출: '브랜드검색광고_PC' → 'pc'
    const device = adGroup.includes('PC') ? 'pc' : 'mobile';

    results.push({
      date,
      device,
      impressions: parseInt(impressions) || 0,
      clicks: parseInt(clicks) || 0,
    });
  }

  return results;
}
```

---

## 7. 테스트 계획

### 7.1 단위 테스트

| 테스트 | 설명 | 예상 결과 |
|--------|------|----------|
| CSV 파싱 - 정상 | 정상 CSV 파싱 | PC/모바일 분리 |
| CSV 파싱 - 빈 파일 | 빈 CSV | 빈 배열 반환 |
| CSV 파싱 - 잘못된 형식 | 헤더만 있는 CSV | 빈 배열 반환 |
| 날짜 변환 | '2025.12.03.' | '2025-12-03' |
| 디바이스 추출 | '브랜드검색광고_PC' | 'pc' |
| CTR 계산 | 클릭 100, 노출 1000 | 10.00% |

### 7.2 통합 테스트

| 테스트 | 설명 |
|--------|------|
| CSV 업로드 → DB 저장 | 업로드 후 DB 확인 |
| API 조회 → 집계 정확성 | 일별/월별 합계 검증 |
| 중복 업로드 | UPSERT 동작 확인 |
| 클라이언트 설정 → UI | 조건부 렌더링 확인 |

### 7.3 테스트 데이터

```typescript
const TEST_CSV = `캠페인,일별,광고그룹,노출수,클릭수
브랜드검색광고,2025.12.01.,브랜드검색광고_PC,100,50
브랜드검색광고,2025.12.01.,브랜드검색광고_모바일,200,80
브랜드검색광고,2025.12.02.,브랜드검색광고_PC,150,60
브랜드검색광고,2025.12.02.,브랜드검색광고_모바일,250,100`;

const EXPECTED_DAILY = [
  { date: '2025-12-01', pc_impressions: 100, pc_clicks: 50, mobile_impressions: 200, mobile_clicks: 80 },
  { date: '2025-12-02', pc_impressions: 150, pc_clicks: 60, mobile_impressions: 250, mobile_clicks: 100 },
];
```

---

## 8. 구현 순서 (TDD)

### Phase 1: 테스트 작성 (Red)

1. CSV 파서 테스트 작성
2. API 테스트 작성
3. 컴포넌트 테스트 작성

### Phase 2: 구현 (Green)

1. DB 마이그레이션
2. CSV 파서 구현
3. API 구현
4. 컴포넌트 구현

### Phase 3: 리팩토링 (Refactor)

1. 에러 처리 강화
2. 성능 최적화
3. 코드 정리

---

## 9. 체크리스트

### 9.1 개발 완료 기준

- [ ] DB 테이블 생성
- [ ] CSV 파서 테스트 통과
- [ ] 업로드 API 테스트 통과
- [ ] 조회 API 테스트 통과
- [ ] Admin 업로드 페이지 동작
- [ ] 대시보드 브랜드검색 표시
- [ ] 클라이언트 설정 연동

### 9.2 배포 전 확인

- [ ] 프로덕션 DB 마이그레이션
- [ ] 나라똔 테스트 데이터 업로드
- [ ] 대시보드 표시 확인
- [ ] 모바일 반응형 확인

---

## 부록: 나라똔 클라이언트 설정

```json
{
  "id": "c2f60730-f8c1-4361-b9fc-3b44725c3955",
  "slug": "나라똔",
  "client_type": "consulting",
  "naver_type": "brand_search",
  "naver_enabled": false,
  "naver_show_keywords": false,
  "naver_show_detail_tab": true,
  "naver_fixed_budget": 1320000
}
```
