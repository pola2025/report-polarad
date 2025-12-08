# Polarad Meta 프로젝트

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

### 1. [버그] 리포트 API 수정 (최우선)
- **파일**: `dashboard/src/app/api/reports/monthly/[id]/route.ts`
- **70행**: `const clientUuid = report.polarad_clients?.id` 확인
- Meta/네이버 데이터 조회 시 UUID 사용 필요

### 2. 주간 리포트 담당자 코멘트 섹션 제거
- **파일**: `dashboard/src/app/report/monthly/[id]/page.tsx`
- 183~189행: `report.report_type === 'weekly'`일 때 `AdminCommentSection` 숨김

### 3. 네이버 키워드 그래프 가독성 개선
- **파일**: `dashboard/src/components/report/NaverKeywordsSection.tsx`
- 바 높이 h-6 → h-8 이상으로
- 값 표시를 바 바깥에 배치

### 4. AI 인사이트 생성 (실제 분석 내용)
- 현재 "월말 성과 마무리", "12월 준비" 같은 빈말임
- 필요: 10월 월간, 11월 월간, 11월 주간 (1~4주차)
- DB 업데이트 필요 (`polarad_reports.ai_insights`)

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
