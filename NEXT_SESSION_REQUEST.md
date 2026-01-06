# 다음 세션 요청문

## 복사해서 사용:
```
polarad-meta 프로젝트 이어서 작업. NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 다음 세션 작업 (우선순위)

### 1. Meta 자동 백필 Vercel Cron 설정 확인
- **목적**: 매일 자동으로 Meta 데이터가 Airtable에 백필되는지 확인
- **확인 사항**:
  - Vercel cron 설정 (`vercel.json`)
  - cron API 라우트 (`/api/cron/backfill`)
  - Airtable에 저장하도록 되어 있는지 (Supabase 아님!)
  - 캠페인별 데이터 수집 (`level=campaign`)
- **중요**: 백필 시 항상 Airtable에 저장되어야 함

---

## 이전 세션 완료 작업 (2026-01-06)

### 1. 관리자 코멘트 기능 추가
- ✅ 주간/월간 리포트 페이지에 AdminCommentSection 추가
- ✅ 코멘트 API를 Supabase → Airtable로 변경
- ✅ 관리자만 코멘트 작성/수정 가능

### 2. 백필 스크립트 캠페인별 데이터 수집으로 변경
- ✅ `level=account` → `level=campaign` 변경
- ✅ campaign_name 필드 추가
- ✅ upsert 키에 campaign_name 추가
- ✅ 기존 Meta 데이터 삭제 후 전체 재백필 (234개 레코드)

### 3. 영상 데이터 추가
- ✅ video_views, avg_watch_time 필드 추가
- ✅ Meta API fields에 video_p100_watched_actions, video_avg_time_watched_actions 추가

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 로컬 경로 | `F:\polarad-meta` |
| GitHub | `pola2025/report-polarad` |
| 프로덕션 URL | https://report.polarad.co.kr |
| 환경변수 | `dashboard/.env.local` |

---

## 데이터 소스 (⛔ 중요!)

| 항목 | 데이터 소스 |
|------|-------------|
| Meta 광고 데이터 | **Airtable** |
| 네이버 광고 데이터 | **Airtable** |
| 리포트/코멘트 | **Airtable** |

**❌ Supabase 사용 금지** - polarad_meta_data, polarad_naver_data 테이블 사용하지 않음

---

## H.E.A 판교 Airtable 설정

| 항목 | 값 |
|------|-----|
| Base ID | `appJlOqnadLsMJQYw` |
| 광고 데이터 Table | `tbl8ftclEFG5ypohX` |
| Reports Table | `tbl4BAtILQRH7JQaG` |
| Comments Table | `tbl5u19uUCdPl4TCg` |
| slug | `hea-pangyo` |

---

## 백필 관련

### 수동 백필 명령어
```bash
node scripts/backfill-airtable.js --client "H.E.A 판교" --start YYYY-MM-DD --end YYYY-MM-DD
```

### 자동 백필 (확인 필요)
- Vercel Cron으로 매일 실행되어야 함
- **반드시 Airtable에 저장**되어야 함

---

## 최근 커밋

```
8ccc36c fix: backfill-airtable.js 캠페인별 데이터 수집으로 변경
5dc42a7 fix: backfill-airtable.js에 video_views, avg_watch_time 추가
798b966 feat: 관리자 코멘트 기능 추가
```
