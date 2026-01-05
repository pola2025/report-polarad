# PRD: 클라이언트 타입 시스템 및 Google Analytics 연동

## 1. 개요

### 1.1 목적
- 클라이언트 업종별 맞춤 대시보드 제공
- Google Analytics 데이터 자동 연동
- 네이버 광고 데이터 ON/OFF 기능

### 1.2 배경
현재 시스템은 모든 클라이언트에 동일한 대시보드를 제공하지만, 업종별로 필요한 데이터가 다름:
- **식당**: 네이버 플레이스 광고 + 키워드 분석 필요
- **경영컨설팅**: 홈페이지 트래픽 분석 + 브랜드검색량 중심

---

## 2. 클라이언트 타입 정의

### 2.1 업종 타입 (client_type)

| 타입 | 설명 | 네이버 플레이스 | 네이버 브랜드검색 | GA 연동 |
|------|------|----------------|------------------|---------|
| `restaurant` | 식당/요식업 | ✅ 필수 | ❌ | 선택 |
| `consulting` | 경영컨설팅 | ❌ | ✅ 선택 | ✅ 필수 |
| `ecommerce` | 이커머스 | ❌ | ✅ 선택 | ✅ 필수 |
| `general` | 일반 | 선택 | 선택 | 선택 |

### 2.2 네이버 설정 (naver_config)

```typescript
interface NaverConfig {
  enabled: boolean;           // 네이버 데이터 표시 여부
  type: 'place' | 'brand_search' | 'both';  // 네이버 광고 타입
  show_keywords: boolean;     // 키워드 분석 표시
  show_detail_tab: boolean;   // 네이버 상세 탭 표시
  fixed_budget?: number;      // 고정 예산 (브랜드검색용)
}
```

### 2.3 기본값 by 업종

| 업종 | naver_enabled | naver_type | show_keywords | show_detail_tab |
|------|--------------|------------|---------------|-----------------|
| restaurant | true | place | true | true |
| consulting | false | brand_search | false | false |
| ecommerce | true | brand_search | false | false |
| general | true | place | true | true |

---

## 3. Google Analytics 연동

### 3.1 데이터 흐름

```
Google Analytics API
        ↓
   Cron Job (1일 1회)
        ↓
   Supabase (polarad_analytics_cache)
        ↓
   Frontend (캐시된 데이터 표시)
```

### 3.2 저장할 GA 메트릭

| 메트릭 | 설명 | API 필드 |
|--------|------|----------|
| sessions | 세션 수 | ga:sessions |
| users | 사용자 수 | ga:users |
| pageviews | 페이지뷰 | ga:pageviews |
| bounce_rate | 이탈률 | ga:bounceRate |
| avg_session_duration | 평균 세션 시간 | ga:avgSessionDuration |
| new_users | 신규 사용자 | ga:newUsers |

### 3.3 캐시 전략

- **갱신 주기**: 1일 1회 (새벽 6시)
- **데이터 보관**: 최근 90일
- **캐시 히트**: 프론트엔드에서 Supabase 직접 조회
- **캐시 미스**: 없음 (항상 캐시 데이터 사용)

---

## 4. DB 스키마 변경

### 4.1 polarad_clients 테이블 수정

```sql
-- 기존 컬럼 유지 + 신규 컬럼 추가
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) DEFAULT 'general';
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_enabled BOOLEAN DEFAULT true;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_show_keywords BOOLEAN DEFAULT true;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_show_detail_tab BOOLEAN DEFAULT true;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_fixed_budget INTEGER;

-- Google Analytics 설정
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS ga_property_id VARCHAR(50);
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS ga_enabled BOOLEAN DEFAULT false;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS ga_credentials JSONB;
```

### 4.2 신규 테이블: polarad_analytics_cache

```sql
CREATE TABLE polarad_analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES polarad_clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- GA 메트릭
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  new_users INTEGER DEFAULT 0,

  -- 메타데이터
  source VARCHAR(20) DEFAULT 'ga4',  -- 'ga4' | 'ua' | 'manual'
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, date)
);

-- 인덱스
CREATE INDEX idx_analytics_cache_client_date ON polarad_analytics_cache(client_id, date DESC);
```

---

## 5. API 설계

### 5.1 클라이언트 API 수정

**GET /api/client?slug={slug}**

응답 확장:
```json
{
  "success": true,
  "client": {
    "id": "uuid",
    "client_name": "나라똔",
    "slug": "나라똔",
    "client_type": "consulting",
    "meta_metric_type": "lead",
    "naver": {
      "enabled": false,
      "type": "brand_search",
      "show_keywords": false,
      "show_detail_tab": false,
      "fixed_budget": 1320000
    },
    "ga": {
      "enabled": true,
      "property_id": "GA4-XXXXXX"
    }
  }
}
```

### 5.2 신규 API: Analytics

**GET /api/analytics?client_id={id}&start_date={date}&end_date={date}**

```json
{
  "success": true,
  "data": {
    "summary": {
      "sessions": 1234,
      "users": 890,
      "pageviews": 3456,
      "bounce_rate": 45.2,
      "avg_session_duration": 120.5
    },
    "daily": [
      { "date": "2025-01-01", "sessions": 100, "users": 80, ... },
      { "date": "2025-01-02", "sessions": 120, "users": 95, ... }
    ],
    "cache_info": {
      "last_synced": "2025-01-05T06:00:00Z",
      "source": "ga4"
    }
  }
}
```

---

## 6. 프론트엔드 변경

### 6.1 조건부 렌더링

```typescript
// 클라이언트 타입에 따른 UI 분기
if (clientInfo.client_type === 'restaurant') {
  // 식당: 네이버 플레이스 전체 표시
  showNaverPlace = true;
  showNaverKeywords = true;
  showNaverDetailTab = true;
  showGASection = clientInfo.ga?.enabled;
} else if (clientInfo.client_type === 'consulting') {
  // 경영컨설팅: GA 중심, 네이버는 브랜드검색만 (선택)
  showNaverPlace = false;
  showNaverKeywords = false;
  showNaverDetailTab = false;
  showNaverBrandSearch = clientInfo.naver?.enabled;
  showGASection = true;
}
```

### 6.2 새로운 섹션: 홈페이지 트래픽

```
┌─────────────────────────────────────────────────────────────┐
│ 홈페이지 트래픽 (Google Analytics)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 세션    │  │ 사용자  │  │ 페이지뷰 │  │ 이탈률  │        │
│  │ 1,234   │  │ 890     │  │ 3,456   │  │ 45.2%   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  [일별 트래픽 추이 차트]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Admin 페이지 변경

### 7.1 클라이언트 등록 폼

```
┌─────────────────────────────────────────────────────────────┐
│ 신규 클라이언트 등록                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 기본 정보                                                   │
│ ┌─────────────────┐  ┌─────────────────┐                   │
│ │ 클라이언트명    │  │ 슬러그          │                   │
│ │ [          ]    │  │ [          ]    │                   │
│ └─────────────────┘  └─────────────────┘                   │
│                                                             │
│ 업종 선택                                                   │
│ ○ 식당 (네이버 플레이스 광고 중심)                          │
│ ● 경영컨설팅 (홈페이지 트래픽 중심)                         │
│ ○ 이커머스 (전환 추적 중심)                                 │
│ ○ 일반                                                      │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ Meta 광고 설정                                              │
│ ┌─────────────────┐  ┌─────────────────┐                   │
│ │ 광고 계정 ID    │  │ 액세스 토큰     │                   │
│ │ [          ]    │  │ [          ]    │                   │
│ └─────────────────┘  └─────────────────┘                   │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ 네이버 설정 (경영컨설팅: 선택사항)                          │
│ ☐ 네이버 데이터 사용                                        │
│   └ 타입: ○ 브랜드검색 ○ 플레이스                          │
│   └ 월 고정 예산: [1,320,000] 원                           │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ Google Analytics 설정                                       │
│ ☑ GA 연동 사용                                              │
│   └ Property ID: [GA4-XXXXXX]                              │
│   └ 서비스 계정 JSON: [파일 업로드]                         │
│                                                             │
│                              [취소] [등록]                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 구현 우선순위

### Phase 1: 클라이언트 타입 시스템 (1-2일)
1. DB 스키마 마이그레이션
2. /api/client 응답 확장
3. 프론트엔드 조건부 렌더링
4. Admin 클라이언트 등록 폼 수정

### Phase 2: Google Analytics 연동 (2-3일)
1. GA4 API 연동 설정
2. polarad_analytics_cache 테이블 생성
3. 데이터 동기화 스크립트 (Cron)
4. /api/analytics 엔드포인트
5. 프론트엔드 GA 섹션 추가

### Phase 3: 테스트 및 배포 (1일)
1. 나라똔 클라이언트 설정 업데이트
2. E2E 테스트
3. 프로덕션 배포

---

## 9. 기술 스택

- **GA API**: Google Analytics Data API v1 (GA4)
- **인증**: 서비스 계정 (JSON 키)
- **스케줄러**: Vercel Cron 또는 외부 Cron
- **캐시**: Supabase PostgreSQL

---

## 10. 보안 고려사항

1. **GA 서비스 계정 키**: Supabase에 암호화 저장
2. **API Rate Limit**: GA API 일일 한도 고려 (기본 10,000 req/day)
3. **데이터 접근**: 클라이언트별 데이터 격리

---

## 부록: 마이그레이션 스크립트

```sql
-- 기존 클라이언트 타입 설정
UPDATE polarad_clients
SET client_type = 'restaurant',
    naver_enabled = true,
    naver_show_keywords = true,
    naver_show_detail_tab = true
WHERE slug = 'hea-pangyo';

UPDATE polarad_clients
SET client_type = 'consulting',
    naver_enabled = false,
    naver_show_keywords = false,
    naver_show_detail_tab = false,
    naver_fixed_budget = 1320000
WHERE slug = '나라똔';
```
