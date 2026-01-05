# 다음 세션 요청문

## 복사해서 사용:
```
Polarad Meta - Airtable 마이그레이션 마무리 작업.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 완료된 작업

### Phase 1: H.E.A 판교 Meta 마이그레이션 ✅
- Supabase → Airtable 마이그레이션 완료
- 158개 레코드 (일별 + 디바이스별 집계)

### Phase 2: 나라똔 Meta 마이그레이션 ✅
- Supabase → Airtable 마이그레이션 완료
- 53개 레코드

### Phase 3: 네이버 데이터 입력 ✅
- 나라똔 12월 브랜드검색 데이터: 57개 레코드 (노출 1,395, 클릭 876)
- H.E.A 판교 네이버 플레이스 데이터: 2개 레코드 (12/15 데이터)

### Phase 4: 프론트엔드 API 수정 (진행 중)
- ✅ Airtable 라이브러리 생성: `dashboard/src/lib/airtable.ts`
- ✅ `/api/naver/brand-search` API를 Airtable로 전환
- ✅ BrandSearchTable 컴포넌트에 안내문 props 추가 (`isManualDataOnly`)
- ⏳ 메인 페이지에서 나라똔일 때 `isManualDataOnly={true}` 전달 필요

---

## 남은 작업

### 1. 메인 페이지 수정 (page.tsx:1499)
```tsx
<BrandSearchTable
  daily={brandSearchData.data.daily}
  monthly={brandSearchData.data.monthly}
  monthlyBudget={brandSearchData.data.fixed_budget}
  isManualDataOnly={clientSlug === '나라똔'}  // 추가 필요
/>
```

### 2. Phase 5: Vercel Cron 설정
- 매일 새벽 3시 KST Meta 데이터 자동 백필
- 스크립트: `scripts/backfill-airtable.js`
- Vercel Cron 또는 Cloudflare Workers 활용

### 3. 빌드 및 배포 테스트

---

## Airtable 설정

| 클라이언트 | Base ID | Table ID |
|-----------|---------|----------|
| H.E.A 판교 | appJlOqnadLsMJQYw | tbl8ftclEFG5ypohX |
| 나라똔 | appN2KzUoORRrb8X9 | tblmC9Ft2ioXKXsrL |

**토큰**: `.env.local`의 `AIRTABLE_API_KEY` 참조

### Airtable 필드
- date, device, impressions, clicks, spend, source, campaign_name, keywords, is_finalized

### 데이터 소스
- `meta`: Meta 광고 데이터
- `naver_place`: 네이버 플레이스 광고 (H.E.A 판교)
- `naver_brand_search`: 네이버 브랜드검색 광고 (나라똔 수동 입력)

---

## 환경변수 (dashboard/.env.local)

```bash
# Airtable
AIRTABLE_API_KEY=patLrqsWWAheA6dVc.xxx
AIRTABLE_HEA_BASE_ID=appJlOqnadLsMJQYw
AIRTABLE_HEA_TABLE_ID=tbl8ftclEFG5ypohX
AIRTABLE_NARATTON_BASE_ID=appN2KzUoORRrb8X9
AIRTABLE_NARATTON_TABLE_ID=tblmC9Ft2ioXKXsrL

# Cloudflare
CLOUDFLARE_API_TOKEN=_-UNLRYLi34TiE6wAWEC-fwcEvL01G2yPt-1YPIW
```

---

## 스크립트 목록

| 스크립트 | 용도 |
|---------|------|
| `scripts/backfill-airtable.js` | Meta 데이터 백필 → Airtable |
| `scripts/migrate-to-airtable.js` | Supabase → Airtable 마이그레이션 |
| `scripts/import-naver-csv.js` | 나라똔 네이버 CSV → Airtable |
| `scripts/import-hea-naver-tsv.js` | H.E.A 네이버 TSV → Airtable |

---

## 클라이언트별 데이터 흐름

### H.E.A 판교
- Meta: 자동 백필 ✅
- Naver 플레이스: 자동 백필 ✅ (키워드 제외) → 월마감 시 키워드 포함 수동 입력

### 나라똔
- Meta: 자동 백필 ✅
- Naver 브랜드검색: 수동 입력만 (API 제한) → 대시보드 안내문 표시

---

## PRD 문서
- `docs/PRD-Airtable-Migration.md`

## 프로젝트 정보
- **경로**: `F:\polarad-meta`
- **대시보드**: `F:\polarad-meta\dashboard`
- **프로덕션**: https://report.polarad.co.kr
- **Vercel 설정**: https://vercel.com/mkt9834-4301s-projects/report-polarad/settings
