# 다음 세션 요청문

## 복사해서 사용:
```
나라똔 Meta 데이터 백필 및 점검 필요.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 🚨 필수 주의사항 (반드시 준수)

### H.E.A 판교 데이터 보호
- ❌ HEA 판교 데이터 자동 백필 금지
- ❌ HEA 판교 데이터 전체 백필 금지
- ❌ HEA 판교 데이터 일괄 삭제/수정 금지
- ❌ HEA 판교 Airtable (`appJlOqnadLsMJQYw`) 접근 금지

### 나라똔 작업 시
- ✅ 나라똔 전용 Airtable만 사용: `appN2KzUoORRrb8X9` / `tblmC9Ft2ioXKXsrL`
- ✅ CLIENT 환경변수 반드시 "나라똔"으로 설정
- ✅ 백필 전 기존 데이터 확인
- ✅ 중복 데이터 발생하지 않도록 주의

---

## 이번 세션 완료 작업

### 1. HEA 판교 Meta 중복 데이터 정리 ✅
- 정리 전: 234개
- 정리 후: 92개
- 삭제: 152개

### 2. 백필 UPSERT 로직 강화 ✅
- `dashboard/scripts/backfill-meta-ads.js` 개선
- 기존 레코드 일괄 로드 → 맵 기반 중복 체크
- 생성/업데이트 후 맵 즉시 갱신

### 3. CLAUDE.md 주의사항 추가 ✅
- 클라이언트별 작업 시 주의사항
- H.E.A 판교 데이터 보호 규칙

---

## 다음 세션 작업

### 나라똔 Meta 데이터 점검 및 백필
1. 나라똔 현재 데이터 현황 확인
2. 중복 데이터 있는지 점검
3. 필요 시 백필 진행

---

## 현재 HEA 판교 데이터 현황 (건드리지 말 것!)

```
총 레코드: 92개
- 2025-10: 22개 | 노출: 97,556
- 2025-11: 23개 | 노출: 192,660
- 2025-12: 31개 | 노출: 127,961
- 2026-01: 16개 | 노출: 30,099
```

---

## 클라이언트별 Airtable 정보

| 클라이언트 | Base ID | Table ID | 백필 스크립트 |
|-----------|---------|----------|--------------|
| H.E.A 판교 | `appJlOqnadLsMJQYw` | `tbl8ftclEFG5ypohX` | `backfill-meta-ads.js` (광고 레벨) |
| 나라똔 | `appN2KzUoORRrb8X9` | `tblmC9Ft2ioXKXsrL` | `backfill-airtable.js` (캠페인 레벨) |

---

## 백필 명령어

### 나라똔 Meta 백필 (캠페인 레벨)
```bash
cd scripts
node backfill-airtable.js --client "나라똔" --days 30
```

### 나라똔 Meta 백필 (광고 레벨) - 필요 시
```bash
cd dashboard
CLIENT="나라똔" BACKFILL_START=2026-01-01 BACKFILL_END=2026-01-06 node --env-file=.env.local scripts/backfill-meta-ads.js
```

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 로컬 경로 | `F:\polarad-meta` |
| GitHub | `pola2025/report-polarad` |
| 프로덕션 URL | https://report.polarad.co.kr |
| 환경변수 | `dashboard/.env.local` |

---

## 데이터 소스 (중요!)

| 항목 | 데이터 소스 |
|------|-------------|
| Meta 광고 데이터 | **Airtable** |
| 네이버 광고 데이터 | **Airtable** |

**⛔ Supabase 사용 금지** - polarad_meta_data, polarad_naver_data 테이블 사용하지 않음
