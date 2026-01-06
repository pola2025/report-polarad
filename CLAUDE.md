# Polarad Meta 프로젝트

## ⛔⛔⛔ 데이터 소스: Airtable 전용 (CRITICAL) ⛔⛔⛔

**이 프로젝트는 Supabase를 데이터 소스로 사용하지 않습니다!**

| 항목 | 데이터 소스 |
|------|-------------|
| Meta 광고 데이터 | **Airtable** |
| 네이버 광고 데이터 | **Airtable** |
| 클라이언트 정보 | **Airtable** |

### Airtable 설정
- **H.E.A 판교**: `appJlOqnadLsMJQYw` / `tbl8ftclEFG5ypohX`
- **나라똔**: `appN2KzUoORRrb8X9` / `tblmC9Ft2ioXKXsrL`

### ❌ 금지 사항
- Supabase에서 광고 데이터 조회 금지
- `polarad_meta_data`, `polarad_naver_data` 테이블 사용 금지
- Supabase 클라이언트로 데이터 조회 금지

### ✅ 필수 사항
- 모든 광고 데이터는 `fetchAirtableData()` 함수 사용
- `AIRTABLE_CONFIG`에 정의된 설정 사용

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
