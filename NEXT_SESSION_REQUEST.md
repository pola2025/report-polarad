# Report API Airtable 마이그레이션 완료

## 완료일: 2026-01-06

---

## 완료된 작업

| 항목 | 상태 |
|------|------|
| Airtable Reports 테이블 생성 | ✅ |
| Airtable Comments 테이블 생성 | ✅ |
| airtable.ts 리포트 함수 추가 | ✅ |
| /api/admin/reports 마이그레이션 | ✅ |
| /api/reports/monthly/[id] 마이그레이션 | ✅ |
| /api/reports 마이그레이션 | ✅ |
| 테스트 및 검증 | ✅ |

---

## 테스트 결과 (2026-01-06)

### /api/reports?clientSlug=hea-pangyo
- ✅ 리포트 목록 정상 반환
- ✅ 클라이언트 정보 포함 (name: "H.E.A 판교")

### /api/reports/monthly/{id}
- ✅ 리포트 상세 정보 반환
- ✅ AI insights 포함
- ✅ Meta 광고 데이터 (daily: 31개, campaigns: 1개)
- ✅ Naver 데이터 (해당 기간 데이터 없음 - 정상)

---

## Airtable 구조

### Reports 테이블
- **Base ID**: `appJlOqnadLsMJQYw`
- **Table ID**: `tbl4BAtILQRH7JQaG`

### Comments 테이블
- **Base ID**: `appJlOqnadLsMJQYw`
- **Table ID**: `tbl5u19uUCdPl4TCg`

---

## 수정된 파일

1. `dashboard/src/lib/airtable.ts`
   - 리포트 CRUD 함수 추가
   - 코멘트 CRUD 함수 추가
   - `getClientSlugById()` 한글 클라이언트 ID 매핑 추가

2. `dashboard/src/app/api/admin/reports/route.ts`
   - Supabase → Airtable 완료

3. `dashboard/src/app/api/reports/route.ts`
   - Supabase → Airtable 완료

4. `dashboard/src/app/api/reports/monthly/[id]/route.ts`
   - Supabase → Airtable 완료

---

## 환경변수 (필수)

```
AIRTABLE_API_KEY=xxx
AIRTABLE_REPORTS_BASE_ID=appJlOqnadLsMJQYw
AIRTABLE_REPORTS_TABLE_ID=tbl4BAtILQRH7JQaG
AIRTABLE_COMMENTS_TABLE_ID=tbl5u19uUCdPl4TCg
```

---

## 클라이언트 slug 매핑

`getClientSlugById()` 함수에서 다음 매핑 지원:

| 입력값 | 반환값 |
|--------|--------|
| `3ff2896e-6786-4936-9c57-311f69f43c63` | `hea-pangyo` |
| `h-e-a-판교` | `hea-pangyo` |
| `H.E.A 판교` | `hea-pangyo` |
| `c2f60730-f8c1-4361-b9fc-3b44725c3955` | `naratton` |
| `나라똔` | `naratton` |

---

## 주의사항

⛔ **Supabase 사용 금지**
- `polarad_reports` 테이블 사용 금지
- `polarad_report_comments` 테이블 사용 금지
- 모든 리포트 데이터는 Airtable에서 조회

---

## 다음 작업 (선택사항)

- [ ] 프로덕션 배포 후 검증
- [ ] Supabase polarad_reports, polarad_report_comments 테이블 백업 후 삭제 (선택)
