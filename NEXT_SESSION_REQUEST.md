# 다음 세션 요청문

## 복사해서 사용:
```
Supabase → Airtable 이관 완료 확인 및 프로덕션 테스트.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## ✅ 완료된 작업 (2025-01-06)

### Supabase → Airtable 이관 완료

| API | 클라이언트 조회 | 데이터 저장소 | 상태 |
|-----|---------------|-------------|------|
| `/api/admin/clients` | ✅ Airtable | - | ✅ 완료 |
| `/api/naver/brand-search` | ✅ Airtable | ✅ Airtable | ✅ 완료 |
| `/api/admin/upload/naver` | ✅ Airtable | ✅ Airtable | ✅ 완료 |
| `/api/admin/upload/brand-search` | ✅ Airtable | ✅ Airtable | ✅ 완료 |
| `/api/naver/analytics` | ✅ Airtable | ✅ Airtable | ✅ 완료 |
| `/api/admin/keywords` | ✅ Airtable | ⚠️ 대기 | 테이블 생성 필요 |

---

## 📋 남은 작업

### 1. 키워드 통계 Airtable 테이블 생성
- **위치**: `appC3XKBcYgZBTETn` Base (클라이언트와 같은 Base)
- **필요한 필드**:
  - `client_id` (Single line text)
  - `year_month` (Single line text, YYYY-MM 형식)
  - `keyword` (Single line text)
  - `pc_searches` (Number)
  - `mobile_searches` (Number)
  - `notes` (Long text)
- 테이블 생성 후 `dashboard/src/app/api/admin/keywords/route.ts` 19행에 Table ID 입력

### 2. 프로덕션 배포 및 테스트
- `git add . && git commit -m "feat: Supabase → Airtable 이관 완료" && git push`
- Vercel 자동 배포 확인
- CSV 업로드 테스트 (네이버 플레이스, 브랜드검색)

---

## Airtable 구조

### 클라이언트 테이블
- **Base**: `appC3XKBcYgZBTETn`
- **Table**: `tblwQBbsMyg00qi8F`
- **URL**: https://airtable.com/appC3XKBcYgZBTETn/tblwQBbsMyg00qi8F

### 광고 데이터 테이블 (클라이언트별)
| 클라이언트 | Base ID | Table ID | 용도 |
|-----------|---------|----------|------|
| H.E.A 판교 | appJlOqnadLsMJQYw | tbl8ftclEFG5ypohX | 광고 데이터 캐시 |
| 나라똔 | appN2KzUoORRrb8X9 | tblmC9Ft2ioXKXsrL | 광고 데이터 캐시 |

### 광고 데이터 스키마
```
- date: 날짜 (YYYY-MM-DD)
- device: 디바이스 (pc/mobile/all)
- impressions: 노출수
- clicks: 클릭수
- spend: 비용
- source: 소스 (meta/naver_place/naver_brand_search)
- keywords: 키워드 목록 (쉼표 구분)
- is_finalized: 확정 여부
```

---

## 프로젝트 정보

- **경로**: F:\polarad-meta
- **GitHub**: https://github.com/pola2025/report-polarad
- **프로덕션**: https://report.polarad.co.kr
- **환경변수**: dashboard/.env.local
