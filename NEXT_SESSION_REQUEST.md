# 다음 세션 요청문

## 복사해서 사용:
```
CSV 업로드 및 애널리틱스 API Supabase → Airtable 이관.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## ✅ 이번 세션 완료 작업

1. **Airtable 클라이언트 테이블 생성**
   - Base: `appC3XKBcYgZBTETn`
   - Table: `tblwQBbsMyg00qi8F`
   - URL: https://airtable.com/appC3XKBcYgZBTETn/tblwQBbsMyg00qi8F

2. **API Airtable 연동 완료**
   - `/api/admin/clients` GET/POST/PUT → Airtable
   - `/api/naver/brand-search` → Airtable (이미 연동됨)

---

## 📋 다음 세션 작업 (Supabase → Airtable 이관)

### 1. 네이버 플레이스 CSV 업로드 (`/api/admin/upload/naver`)
- [ ] 클라이언트 확인: Supabase → Airtable 클라이언트 테이블
- [ ] 데이터 저장: Supabase `polarad_naver_data` → Airtable
- **파일**: `dashboard/src/app/api/admin/upload/naver/route.ts`

### 2. 브랜드검색 CSV 업로드 (`/api/admin/upload/brand-search`)
- [ ] 클라이언트 확인: Supabase → Airtable 클라이언트 테이블
- [ ] 데이터 저장: Supabase `polarad_brand_search_data` → Airtable
- **파일**: `dashboard/src/app/api/admin/upload/brand-search/route.ts`

### 3. 네이버 애널리틱스 (`/api/naver/analytics`)
- [ ] 클라이언트 slug 조회: Supabase → Airtable 클라이언트 테이블
- [ ] 데이터 조회: Supabase `polarad_naver_data` → Airtable
- **파일**: `dashboard/src/app/api/naver/analytics/route.ts`

### 4. 상호명 검색 통계 (`/api/admin/keywords`)
- [ ] 클라이언트 확인: Supabase → Airtable 클라이언트 테이블
- [ ] 데이터 저장: Supabase `polarad_keyword_stats` → Airtable
- **파일**: `dashboard/src/app/api/admin/keywords/route.ts`

---

## Airtable 구조

### 클라이언트 테이블 (완료)
- **Base**: `appC3XKBcYgZBTETn`
- **Table**: `tblwQBbsMyg00qi8F`

### 광고 데이터 테이블 (기존)
| 클라이언트 | Base ID | Table ID | 용도 |
|-----------|---------|----------|------|
| H.E.A 판교 | appJlOqnadLsMJQYw | tbl8ftclEFG5ypohX | 광고 데이터 캐시 |
| 나라똔 | appN2KzUoORRrb8X9 | tblmC9Ft2ioXKXsrL | 광고 데이터 캐시 |

### 필요한 새 테이블 (생성 필요)
- [ ] 키워드 통계 테이블 (상호명 검색량)

---

## 현재 API 상태

| API | 클라이언트 조회 | 데이터 저장소 | 상태 |
|-----|---------------|-------------|------|
| `/api/admin/clients` | ✅ Airtable | - | ✅ 완료 |
| `/api/naver/brand-search` | ✅ Airtable | ✅ Airtable | ✅ 완료 |
| `/api/admin/upload/naver` | ⚠️ Supabase | ⚠️ Supabase | 수정 필요 |
| `/api/admin/upload/brand-search` | ⚠️ Supabase | ⚠️ Supabase | 수정 필요 |
| `/api/naver/analytics` | ⚠️ Supabase | ⚠️ Supabase | 수정 필요 |
| `/api/admin/keywords` | ⚠️ Supabase | ⚠️ Supabase | 수정 필요 |

---

## 프로젝트 정보

- **경로**: F:\polarad-meta
- **GitHub**: https://github.com/pola2025/report-polarad
- **프로덕션**: https://report.polarad.co.kr
- **환경변수**: dashboard/.env.local
