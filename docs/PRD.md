# Polarad Meta - 온라인 광고 리포트 시스템

**PRD (Product Requirements Document)**

**버전**: 1.0
**작성일**: 2025-12-07
**상태**: Draft

---

## 1. 프로젝트 개요

### 1.1 프로젝트명
**Polarad Meta** - 멀티 클라이언트 온라인 광고 리포트 시스템

### 1.2 목적
여러 클라이언트의 온라인 광고 성과를 통합 관리하고, 각 클라이언트에게 투명한 리포트를 제공하는 대시보드 시스템

### 1.3 배경
- Meta 광고, 네이버 플레이스 광고, 상호명 검색 통계 등 여러 채널의 데이터가 분산되어 있음
- 멀티 클라이언트 지원으로 확장 가능한 시스템 필요
- 클라이언트별 맞춤 리포트 제공

### 1.4 참고 프로젝트
- **BAS_Meta** (F:\bas_meta): 동일한 아키텍처 및 기술 스택 활용

### 1.5 클라이언트 목록 (초기)
| 클라이언트 | slug | 설명 |
|-----------|------|------|
| H.E.A 판교 | hea-pangyo | 판교 레스토랑 |

---

## 2. 이해관계자

| 역할 | 설명 | 접근 권한 |
|------|------|----------|
| **관리자** | 광고 운영 담당자 | 전체 기능 접근, 데이터 입력/수정, 모든 클라이언트 조회 |
| **클라이언트** | 광고주 (H.E.A 등) | 본인 리포트 조회 (읽기 전용) |

---

## 3. 데이터 소스

### 3.1 Meta 광고 데이터
- **수집 방식**: Meta Ads API (시스템 사용자 토큰)
- **수집 주기**: 일별 자동 수집 (Cloudflare Worker)
- **주요 지표**:
  - 노출수 (Impressions)
  - 클릭수 (Clicks)
  - 리드수 (Leads/Conversions)
  - 지출액 (Spend)
  - CPL (Cost Per Lead)
  - CTR (Click Through Rate)
  - 영상 조회수, 평균 시청 시간 (해당 시)

### 3.2 네이버 플레이스 광고 데이터
- **수집 방식**: CSV 파일 업로드 (수동)
- **데이터 형식**: 네이버 광고 시스템에서 다운로드한 월간 리포트
- **파일 예시**: `11월_월간리포트,hea_pangyo_naver.csv`
- **주요 필드**:

| 필드명 | 설명 |
|--------|------|
| 일별 | 날짜 (YYYY.MM.DD) |
| 검색어 | 광고 노출된 검색 키워드 |
| 노출수 | 광고 노출 횟수 |
| 클릭수 | 광고 클릭 횟수 |
| 클릭률(%) | CTR |
| 평균클릭비용(VAT포함,원) | CPC |
| 총비용(VAT포함,원) | 총 지출액 |
| 평균노출순위 | 검색 결과 내 평균 순위 |

### 3.3 상호명 검색 키워드 통계
- **수집 방식**: 관리자 수동 입력 (웹 폼)
- **입력 주기**: 월별
- **입력 항목**:

| 필드 | 설명 |
|------|------|
| 연월 | 통계 기준 월 (YYYY-MM) |
| 키워드 | 검색 키워드 (예: "판교 레스토랑", "H.E.A") |
| PC 조회수 | PC에서의 월간 검색량 |
| Mobile 조회수 | 모바일에서의 월간 검색량 |
| 비고 | 추가 메모 (선택) |

---

## 4. 기능 요구사항

### 4.1 대시보드 (메인 페이지)

#### FR-001: 통합 KPI 요약
- **설명**: 전체 채널의 핵심 지표를 카드 형태로 표시
- **표시 항목**:
  - 총 노출수 (Meta + 네이버)
  - 총 클릭수 (Meta + 네이버)
  - 총 지출액 (Meta + 네이버)
  - 총 리드수 (Meta)
  - 평균 CPL (Meta)
  - 상호명 검색량 추이 (월별)

#### FR-002: 채널별 성과 비교
- **설명**: Meta vs 네이버 플레이스 성과 비교 차트
- **차트 유형**: 바 차트, 라인 차트

#### FR-003: 일별/주별/월별 트렌드
- **설명**: 기간별 성과 추이 시각화
- **필터**: 날짜 범위 선택, 채널 선택

#### FR-004: 기간 비교
- **설명**: 이전 기간 대비 성과 비교
- **비교 옵션**: 전주 대비, 전월 대비

### 4.2 Meta 광고 섹션

#### FR-005: Meta 광고 상세
- **설명**: BAS_Meta와 동일한 기능
- **포함 기능**:
  - 캠페인별 성과
  - 광고별 성과 (TOP Ads)
  - 플랫폼별 성과 (Facebook/Instagram)
  - 디바이스별 성과 (Mobile/Desktop)

### 4.3 네이버 플레이스 광고 섹션

#### FR-006: 네이버 데이터 업로드
- **설명**: CSV 파일 업로드 기능
- **처리 로직**:
  1. 파일 선택 및 업로드
  2. CSV 파싱 및 데이터 검증
  3. 중복 체크 (날짜 + 검색어 기준)
  4. DB 저장 (upsert)
  5. 업로드 결과 표시

#### FR-007: 네이버 광고 성과 분석
- **설명**: 업로드된 데이터 기반 분석
- **분석 항목**:
  - 일별 노출/클릭/비용 추이
  - 검색어별 성과 (TOP 검색어)
  - 클릭률 분석
  - 비용 효율 분석

### 4.4 상호명 검색 통계 섹션

#### FR-008: 키워드 통계 입력 폼
- **설명**: 관리자가 월별 검색량 수동 입력
- **입력 필드**:
  - 연월 선택 (Date Picker)
  - 키워드 입력
  - PC 조회수 입력
  - Mobile 조회수 입력
  - 비고 (선택)
- **기능**:
  - 단일 입력
  - 일괄 입력 (테이블 형태)
  - 엑셀 업로드 (선택)

#### FR-009: 검색량 트렌드 차트
- **설명**: 월별 상호명 검색량 추이 시각화
- **차트**: 라인 차트 (PC/Mobile 분리 또는 합계)
- **분석**: 전월 대비 증감률

### 4.5 관리자 기능

#### FR-010: 클라이언트 관리
- **설명**: 클라이언트 정보 관리
- **기능**:
  - 클라이언트 목록 조회
  - 클라이언트 추가/수정
  - Meta 광고 계정 연결
  - 접근 링크 생성 (slug 기반)

#### FR-011: 데이터 백필
- **설명**: 과거 데이터 수집 (Meta)
- **기능**:
  - 기간 지정
  - SSE 실시간 로그

#### FR-012: 시스템 상태 모니터링
- **설명**: 데이터 수집 상태 확인
- **표시 항목**:
  - 마지막 데이터 수집일
  - 토큰 만료일
  - 데이터 건수

### 4.6 클라이언트 뷰

#### FR-013: 클라이언트 전용 리포트
- **설명**: 클라이언트에게 공유되는 읽기 전용 뷰
- **접근 방식**: URL 파라미터 (`?client={slug}`)
- **표시 내용**:
  - 통합 KPI 요약
  - 채널별 성과
  - 트렌드 차트
  - 기간 비교
- **제외 기능**:
  - 데이터 입력/수정
  - 관리자 기능
  - 시스템 설정

---

## 5. 비기능 요구사항

### 5.1 성능
- 대시보드 초기 로딩: 3초 이내
- 데이터 조회 API 응답: 1초 이내
- CSV 업로드 처리: 10MB 파일 기준 5초 이내

### 5.2 보안
- 관리자/클라이언트 접근 분리 (URL 파라미터 + RLS)
- Meta API 토큰 암호화 저장 (Supabase Vault)
- HTTPS 강제

### 5.3 호환성
- 브라우저: Chrome, Safari, Edge 최신 버전
- 반응형: 모바일, 태블릿, 데스크톱

### 5.4 데이터 보존
- 광고 데이터: 최소 2년 보관
- 월별 파티션 테이블

---

## 6. 기술 스택

### 6.0 보안 권고사항 (Critical - 2025년 12월)

> **⚠️ CVE-2025-55182 & CVE-2025-66478 (CVSS 10.0 Critical)**
>
> 2025년 12월 3일 React Server Components (RSC)에서 치명적인 RCE(원격 코드 실행) 취약점이 발견됨.
> 반드시 아래 패치된 버전을 사용해야 함.

#### 영향받는 버전 (사용 금지)
- Next.js 15.x ~ 16.x (패치 전)
- Next.js 14.3.0-canary.77 이후 canary 버전
- React 19.0, 19.1.0, 19.1.1, 19.2.0

#### 영향받지 않는 버전 (안전)
- **Next.js 13.x (전체)**
- **Next.js 14.x stable (14.2.x까지)**
- Pages Router 애플리케이션
- Edge Runtime

#### 패치된 버전 (권장)
| 패키지 | 권장 버전 |
|--------|----------|
| **Next.js** | 14.2.25 (stable, 권장) |
| **Next.js** | 15.5.7, 15.4.8, 15.3.6, 15.2.6, 15.1.9, 15.0.5 |
| **Next.js** | 16.0.7 |
| **React** | 18.x (RSC 미사용 시 안전) |
| **React** | 19.0.1, 19.1.2, 19.2.1 (패치됨) |

#### 본 프로젝트 선택: Next.js 14.2.25 + React 18.3.1
- **이유**:
  - Next.js 14.x stable은 RSC 취약점 영향 없음
  - Pages Router와 App Router 모두 안전하게 사용 가능
  - 가장 안정적이고 검증된 버전
  - BAS_Meta 프로젝트와 호환성 유지

#### 참고 자료
- [React 공식 보안 공지](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [Next.js CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478)
- [Vercel CVE-2025-55182 요약](https://vercel.com/changelog/cve-2025-55182)
- [Palo Alto Unit42 분석](https://unit42.paloaltonetworks.com/cve-2025-55182-react-and-cve-2025-66478-next/)

---

### 6.1 프론트엔드
- **Framework**: Next.js 14.2.25 (보안 패치 적용)
- **UI**: React 18.3.1 + Tailwind CSS 3.4.x
- **차트**: Recharts 2.12.x
- **아이콘**: Lucide React
- **Date**: date-fns 3.x
- **Export**: xlsx 0.18.x

### 6.2 백엔드
- **Database**: Supabase (PostgreSQL)
- **Auth**: URL 파라미터 기반 접근 제어
- **File Storage**: Supabase Storage (CSV 업로드용)
- **Background Jobs**: Cloudflare Workers

### 6.3 외부 연동
- **Meta Ads API**: v22.0
- **Telegram Bot API**: 알림용

### 6.4 권장 package.json 의존성
```json
{
  "dependencies": {
    "next": "14.2.25",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "tailwindcss": "^3.4.1",
    "recharts": "^2.12.7",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.400.0",
    "xlsx": "^0.18.5",
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

---

## 7. 데이터베이스 스키마

### 7.1 clients (클라이언트)
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR UNIQUE NOT NULL,
  client_name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE,
  meta_ad_account_id VARCHAR,
  meta_access_token_id UUID, -- Vault 참조
  token_expires_at TIMESTAMP,
  auth_status VARCHAR DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  telegram_chat_id VARCHAR,
  telegram_enabled BOOLEAN DEFAULT false,
  service_start_date DATE,
  service_end_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 meta_raw_data (Meta 광고 데이터)
```sql
CREATE TABLE meta_raw_data (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  date DATE NOT NULL,
  ad_id VARCHAR NOT NULL,
  ad_name VARCHAR,
  campaign_id VARCHAR,
  campaign_name VARCHAR,
  platform VARCHAR, -- facebook, instagram
  device VARCHAR, -- mobile, desktop
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  avg_watch_time DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR DEFAULT 'KRW',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, date, ad_id, platform, device)
);
```

### 7.3 naver_place_data (네이버 플레이스 광고)
```sql
CREATE TABLE naver_place_data (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  date DATE NOT NULL,
  keyword VARCHAR NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  avg_cpc INTEGER DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  avg_rank DECIMAL(3,1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, date, keyword)
);
```

### 7.4 keyword_stats (상호명 검색 통계)
```sql
CREATE TABLE keyword_stats (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  year_month VARCHAR(7) NOT NULL, -- YYYY-MM
  keyword VARCHAR NOT NULL,
  pc_searches INTEGER DEFAULT 0,
  mobile_searches INTEGER DEFAULT 0,
  total_searches INTEGER GENERATED ALWAYS AS (pc_searches + mobile_searches) STORED,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, year_month, keyword)
);
```

---

## 8. 페이지 구조

```
/                           # 메인 대시보드
├── ?admin={key}            # 관리자 모드 (모든 클라이언트)
└── ?client={slug}          # 클라이언트 모드 (해당 클라이언트만)

/admin                      # 관리자 페이지
├── /clients                # 클라이언트 관리
├── /upload                 # 데이터 업로드
│   ├── /naver              # 네이버 CSV 업로드
│   └── /keywords           # 키워드 통계 입력
└── /settings               # 시스템 설정

/api                        # API 라우트
├── /admin/...              # 관리자 API
├── /clients/...            # 클라이언트 데이터 API
├── /upload/naver           # 네이버 CSV 업로드 API
├── /keywords/...           # 키워드 통계 API
└── /meta/...               # Meta 데이터 API
```

---

## 9. 마일스톤

### Phase 1: 기본 구조 (MVP)
- [ ] 프로젝트 초기 설정 (Next.js 14.2.25, Supabase)
- [ ] 데이터베이스 스키마 생성
- [ ] 기본 레이아웃 및 컴포넌트
- [ ] 접근 제어 시스템

### Phase 2: Meta 광고 연동
- [ ] Meta API 연동
- [ ] Meta 데이터 수집 Worker
- [ ] Meta 광고 대시보드

### Phase 3: 네이버 플레이스 연동
- [ ] CSV 업로드 기능
- [ ] 네이버 데이터 파싱 및 저장
- [ ] 네이버 광고 분석 뷰

### Phase 4: 키워드 통계
- [ ] 키워드 입력 폼
- [ ] 키워드 트렌드 차트
- [ ] 통합 대시보드 완성

### Phase 5: 고도화
- [ ] 클라이언트 공유 뷰
- [ ] 텔레그램 알림
- [ ] Excel 내보내기
- [ ] AI 분석 (선택)

---

## 10. 위험 요소 및 대응

| 위험 | 영향 | 대응 방안 |
|------|------|----------|
| Meta API 토큰 만료 | 데이터 수집 중단 | 토큰 만료 알림, 갱신 프로세스 |
| CSV 형식 변경 | 파싱 오류 | 유연한 파서, 에러 처리 |
| 대용량 데이터 | 성능 저하 | 페이지네이션, 월별 파티션 |

---

## 부록

### A. 네이버 CSV 샘플 데이터
```csv
일별,검색어,노출수,클릭수,클릭률(%),평균클릭비용(VAT포함,원),총비용(VAT포함,원),평균노출순위
2025.11.29.,근처맛집,16,1,6.25,2343,2343,1
2025.11.30.,근처맛집,44,1,2.28,990,990,1
2025.11.17.,근처맛집,28,4,14.29,3135,12540,1.1
```

### B. 키워드 통계 입력 예시
| 연월 | 키워드 | PC 조회수 | Mobile 조회수 |
|------|--------|-----------|---------------|
| 2025-11 | 판교 레스토랑 | 1,200 | 3,400 |
| 2025-11 | H.E.A 판교 | 450 | 890 |
| 2025-11 | 판교 양식 | 800 | 2,100 |

### C. 클라이언트 예시
| slug | 이름 | Meta 계정 | 네이버 플레이스 |
|------|------|----------|----------------|
| hea-pangyo | H.E.A 판교 | act_xxx | 사용 |
