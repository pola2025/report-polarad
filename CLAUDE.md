# Polarad Meta 프로젝트

## 🏗️ 서비스 스택 (CRITICAL - 반드시 숙지)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Polarad Meta 서비스 스택                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  Frontend   │    │   Backend   │    │    CI/CD    │             │
│  │  Next.js    │    │  Next.js    │    │   GitHub    │             │
│  │  (Vercel)   │    │  API Routes │    │   Actions   │             │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │
│         │                  │                  │                     │
│         └────────┬─────────┴──────────────────┘                     │
│                  │                                                   │
│                  ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      데이터 저장소                           │    │
│  ├──────────────────────┬──────────────────────────────────────┤    │
│  │      Airtable        │           Supabase                   │    │
│  │   (메인 데이터)       │        (민감 정보만)                  │    │
│  ├──────────────────────┼──────────────────────────────────────┤    │
│  │ ✅ Meta 광고 데이터   │ ✅ Meta access_token                │    │
│  │ ✅ 네이버 광고 데이터  │ ✅ Meta ad_account_id               │    │
│  │ ✅ 리포트 데이터      │ ✅ 클라이언트 인증 정보              │    │
│  │ ✅ 클라이언트 설정    │                                      │    │
│  │ ✅ 코멘트 데이터      │                                      │    │
│  └──────────────────────┴──────────────────────────────────────┘    │
│                  │                                                   │
│                  ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                        알림                                  │    │
│  │                     Telegram                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 📦 역할별 저장소

| 저장소 | 용도 | 비고 |
|--------|------|------|
| **Airtable** | 광고 데이터, 리포트, 클라이언트 설정 | 메인 데이터 소스 |
| **Supabase** | Meta 토큰, 계정 ID (민감 정보) | 인증 정보만 저장 |
| **Vercel** | 프론트엔드 배포 | report.polarad.co.kr |
| **GitHub Actions** | 자동 백필, 파이프라인 | 새벽 3시 실행 |
| **Telegram** | 알림 | 백필 채널: -1003394139746 |

### 🔑 환경변수 (GitHub Secrets)

| Secret | 용도 |
|--------|------|
| `AIRTABLE_API_KEY` | Airtable 데이터 읽기/쓰기 |
| `SUPABASE_URL` | 클라이언트 토큰 조회 |
| `SUPABASE_SERVICE_KEY` | 클라이언트 토큰 조회 |
| `TELEGRAM_BOT_TOKEN` | 알림 발송 |

---

## ⛔ 데이터 조회 규칙 (CRITICAL)

### ✅ 올바른 사용

```javascript
// 광고 데이터 조회 → Airtable
const data = await fetchAirtableData('hea-pangyo', startDate, endDate, 'meta');

// 클라이언트 토큰 조회 → Supabase
const { data: client } = await supabase
  .from('polarad_clients')
  .select('meta_access_token, meta_ad_account_id')
  .eq('client_name', '나라똔');
```

### ❌ 금지 사항

```javascript
// ❌ Supabase에서 광고 데이터 조회 금지!
await supabase.from('polarad_meta_data').select('*');  // 사용 금지!

// ❌ Airtable에서 토큰 조회 금지!
// (토큰은 Supabase에만 저장)
```

### Airtable 테이블 설정

| 클라이언트 | Base ID | Table ID (광고 데이터) |
|-----------|---------|------------------------|
| H.E.A 판교 | `appJlOqnadLsMJQYw` | `tbl8ftclEFG5ypohX` |
| 나라똔 | `appN2KzUoORRrb8X9` | `tblmC9Ft2ioXKXsrL` |
| 클라이언트 설정 | `appC3XKBcYgZBTETn` | `tblwQBbsMyg00qi8F` |
| 리포트 | `appJlOqnadLsMJQYw` | `tbl4BAtILQRH7JQaG` |
| 코멘트 | `appJlOqnadLsMJQYw` | `tbl5u19uUCdPl4TCg` |

### ⚠️ 클라이언트별 작업 시 주의 (CRITICAL)

**다른 클라이언트 작업 시 기존 클라이언트 데이터 영향 금지!**

| 클라이언트 | Base ID | Table ID |
|-----------|---------|----------|
| H.E.A 판교 | `appJlOqnadLsMJQYw` | `tbl8ftclEFG5ypohX` |
| 나라똔 | `appN2KzUoORRrb8X9` | `tblmC9Ft2ioXKXsrL` |

- 백필 스크립트 실행 전 **반드시 CLIENT 환경변수 확인**
- `--all` 옵션 사용 금지 (클라이언트별 분리 필수)
- 나라똔 작업 시 HEA 판교 데이터 조회/수정 절대 금지
- HEA 판교 작업 시 나라똔 데이터 조회/수정 절대 금지

### 🔒 클라이언트 독립성 원칙 (CRITICAL)

**H.E.A 판교와 나라똔은 완전히 독립적인 클라이언트!**

```
❌ 잘못된 접근: 두 클라이언트를 동일한 데이터 구조로 가정
✅ 올바른 접근: 각 클라이언트별 독립적인 설정/로직 유지
```

| 항목 | H.E.A 판교 | 나라똔 |
|------|-----------|--------|
| 타입 | 식당 (트래픽) | 쇼핑몰 (리드) |
| Meta 지표 | video_views | leads |
| 리드 광고 | ❌ 없음 | ✅ 있음 |
| 홈페이지 접수 | ❌ 없음 | ✅ 있음 |
| Airtable Base | 별도 | 별도 |

**절대 금지:**
- ❌ 한 클라이언트 수정 시 다른 클라이언트 코드/데이터 연동
- ❌ 클라이언트 공통 로직에서 특정 클라이언트 하드코딩
- ❌ "나라똔처럼 HEA도..." 식의 연동 사고

**올바른 접근:**
- ✅ 클라이언트 설정 테이블(`polarad_clients`)에서 개별 설정 조회
- ✅ 클라이언트별 분기 시 독립적인 조건문 사용
- ✅ 한 클라이언트 작업 시 다른 클라이언트 영향 여부 항상 확인

### 🚫 H.E.A 판교 데이터 보호 규칙

**H.E.A 판교 데이터는 사용자 명시적 요청 없이 절대 건드리지 않음!**

- ❌ 자동 백필 금지
- ❌ 전체 백필 금지
- ❌ 일괄 삭제/수정 금지
- ❌ 중복 데이터 생성 금지

**허용되는 경우:**
- ✅ 사용자가 명시적으로 "HEA 판교 백필해줘" 요청 시
- ✅ 사용자가 특정 기간 지정하여 요청 시

---

## ⛔ 환율 규칙 (CRITICAL - 할루시네이션 방지)

### 핵심 원칙: 환율은 **백필 시점에 1회만** 적용!

```
Meta API (USD) → 백필 스크립트 (×1500) → Airtable (KRW) → API (×1) → 프론트엔드
                     ↑                                      ↑
                여기서 1회 적용                         추가 적용 금지!
```

### API 설정 (모두 `return 1`)

```javascript
// ✅ 올바른 설정 - 모든 API에서 동일
function getExchangeRate(_clientSlug: string): number {
  return 1  // Airtable에 이미 KRW로 저장됨
}
```

| API | 파일 | 환율 |
|-----|------|------|
| 대시보드 | `api/dashboard/route.ts` | `return 1` |
| 리포트 | `api/reports/monthly/[id]/route.ts` | `return 1` |
| AI 분석 | `api/ai/analyze/route.ts` | 환율 곱셈 없음 |

### ⚠️ 절대 금지

```javascript
// ❌ 금지! 환율 중복 적용
spend * 1500           // API에서 금지
spend * exchangeRate   // exchangeRate !== 1인 경우 금지
spend * 1350           // 프론트엔드에서 금지 (spend_krw 사용)
```

### 데이터 검증 방법

**하루 예산 $17~19 기준:**
- ✅ 올바른 값: 25,000 ~ 30,000원
- ❌ 잘못된 값: 17~19 (USD 그대로) 또는 3천만원+ (중복 적용)

```bash
# 데이터 확인 명령어
curl "http://localhost:3003/api/dashboard?client=hea-pangyo&period=7d" | grep meta_spend
```

### 주의: 과거 데이터

- **2025년 11월 이전**: 일부 데이터가 USD로 저장되어 있을 수 있음
- **2026년 1월 이후**: 모두 KRW로 저장됨
- 과거 데이터 수정 시 별도 확인 필요

### 히스토리
- 2026-01-29: 환율 중복 적용 문제 발견 및 수정
  - 리포트 API `return 1500` → `return 1`
  - AI 분석 API `* 1500` 제거

---

## ⛔ 과거 연도 데이터 절대 금지 (CRITICAL)

**이 프로젝트는 2024년 이전 데이터를 사용하지 않습니다.**

- **2024년 이전 날짜 절대 사용 금지**
- period_start, period_end, year 필드는 반드시 **현재 연도** 기준
- 현재 2025년 12월 → 2025년 데이터 사용
- 2026년이 되면 → 2026년 데이터 사용
- 리포트 생성, 데이터 백필 시 연도 확인 필수
- 과거 연도 데이터 발견 시 즉시 현재 연도로 수정

---

## 주의사항

### Vercel 프로덕션
- **설정 URL**: https://vercel.com/mkt9834-4301s-projects/report-polarad/settings
- **도메인**: https://report.polarad.co.kr

### Supabase
- **프로젝트**: mpljqcuqrrfwzamfyxnz (Polarad 전용)
- **URL**: https://mpljqcuqrrfwzamfyxnz.supabase.co
- BAS-Meta와 별도 프로젝트임 (혼동 주의)

### 환경변수
- Vercel 환경변수 변경 후 반드시 **Redeploy** 필요

---

## ⚠️ 중요: DB 테이블 client_id 관계 (혼동 주의!)

```
┌─────────────────────────────────────────────────────────────────────┐
│ polarad_clients 테이블                                              │
├─────────────────────────────────────────────────────────────────────┤
│ id (UUID)          : 3ff2896e-6786-4936-9c57-311f69f43c63          │
│ client_id (문자열) : h-e-a-판교                                     │
│ slug               : hea-pangyo                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ polarad_reports │  │ polarad_meta    │  │ polarad_naver   │
│                 │  │ _data           │  │ _data           │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ client_id:      │  │ client_id:      │  │ client_id:      │
│ "h-e-a-판교"    │  │ UUID            │  │ UUID            │
│ (문자열!)       │  │ (3ff2896e-...)  │  │ (3ff2896e-...)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 리포트 API 수정 필요 (버그!)
- **파일**: `dashboard/src/app/api/reports/monthly/[id]/route.ts`
- **문제**: 70행에서 `polarad_clients.id` (UUID)를 사용해야 함
- **현재 데이터 조회 안 되는 이유**: client_id 타입 불일치

---

## 다음 세션 작업 목록

### 1. [긴급] 프로덕션 API 캐시 문제 해결
- **문제**: 프로덕션 API가 2024년 데이터를 계속 반환
- **원인**: Vercel Edge 캐시 또는 CDN 캐시
- **해결 시도**:
  - DB는 이미 2025년으로 수정 완료
  - 로컬 API는 정상 (2025년 반환)
  - `Cache-Control: no-store` 헤더 추가함 (배포 필요)
- **확인 방법**: `curl https://report.polarad.co.kr/api/reports/monthly/1a7a5ff2-a5eb-40f3-9d10-7831bdf4de70`
- 배포 후 period_start가 2025-11-01이어야 정상

### 2. 모바일 최적화 수정
- **파일**: `dashboard/src/components/report/KPISection.tsx`
- KPI 그리드: 이미 `grid-cols-2 md:grid-cols-4`로 되어 있음
- 모바일(390px)에서 4열로 표시되는 문제 확인 필요

### 3. 대시보드 KPI 카드 모바일 반응형
- **파일**: `dashboard/src/app/page.tsx` (463행)
- 현재: `grid-cols-1 md:grid-cols-2 lg:grid-cols-5`
- 모바일에서 확인 필요

---

## H.E.A 판교 클라이언트 정보

| 항목 | 값 |
|------|-----|
| UUID | `3ff2896e-6786-4936-9c57-311f69f43c63` |
| client_id | `h-e-a-판교` |
| slug | `hea-pangyo` |
| 대시보드 URL | `https://report.polarad.co.kr/?client=hea-pangyo` |

## 현재 리포트 목록

| 타입 | 기간 | ID |
|------|------|-----|
| 월간 | 2025-10 | c211a76d-4e10-4f79-a784-8cd576cb4caa |
| 월간 | 2025-11 | 1a7a5ff2-a5eb-40f3-9d10-7831bdf4de70 |
| 주간 | 11월 1주차 | 13a57709-3a78-46b3-87d0-d19eaf5fac7a |
| 주간 | 11월 2주차 | 29b786e9-b90f-4abc-ae45-24ded88a3ee1 |
| 주간 | 11월 3주차 | e9c4ef3c-a800-40da-a413-2180e463e93f |
| 주간 | 11월 4주차 | 0877d00d-3299-4e4a-8ed6-f471ad763d9e |
| 주간 | 12월 1주차 | aef526b7-3326-4cca-ae98-f91d360a1d72 |
