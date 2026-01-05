# PRD: Airtable 기반 데이터 구조 마이그레이션

## 개요

Polarad Meta 프로젝트의 광고 데이터를 Supabase에서 Airtable로 마이그레이션하여 안정적인 캐시 시스템 구축.

## 목표

1. H.E.A 판교 Meta 데이터 → Airtable 마이그레이션
2. 나라똔 Meta 데이터 → Airtable 백필
3. 나라똔 12월 네이버 브랜드검색 데이터 수동 입력
4. 프론트엔드 API를 Airtable 기반으로 전환

---

## 데이터 구조

### Airtable 테이블 필드

| 필드명 | 타입 | 설명 |
|-------|------|------|
| date | Date | YYYY-MM-DD |
| device | Text | pc, mobile, all |
| impressions | Number | 노출수 |
| clicks | Number | 클릭수 |
| spend | Number | 지출 (원) |
| source | Text | meta, naver_place, naver_brand_search |
| campaign_name | Text | 캠페인명 |
| keywords | Long text | 키워드 데이터 (월마감용) |
| is_finalized | Checkbox | 월마감 여부 (true: 수동 입력, false: 백필) |

### Upsert 로직

- **고유 키**: `date + source + device`
- **백필 데이터**: `is_finalized = false`
- **월마감 데이터**: `is_finalized = true` → 기존 백필 덮어쓰기

---

## 클라이언트별 데이터 흐름

### H.E.A 판교

| 소스 | 자동 백필 | 월마감 수동 | 비고 |
|------|----------|------------|------|
| Meta | ✅ | - | 일별 자동 수집 |
| Naver 플레이스 | ✅ (기본) | ✅ (키워드 포함) | 월마감 시 덮어쓰기 |

### 나라똔

| 소스 | 자동 백필 | 월마감 수동 | 비고 |
|------|----------|------------|------|
| Meta | ✅ | - | 일별 자동 수집 |
| Naver 브랜드검색 | ❌ | ✅ | API 제한으로 수동만 |

---

## 작업 체크리스트 (TDD)

### Phase 1: H.E.A 판교 마이그레이션

- [ ] 1.1. Supabase에서 H.E.A 판교 Meta 데이터 조회
- [ ] 1.2. Airtable 형식으로 변환 (일별 + 디바이스별 집계)
- [ ] 1.3. Airtable에 upsert
- [ ] 1.4. 검증: Airtable 레코드 수 확인

### Phase 2: 나라똔 Meta 백필

- [ ] 2.1. Supabase에서 나라똔 클라이언트 정보 확인 (meta_ad_account_id)
- [ ] 2.2. Meta API로 최근 30일 데이터 조회
- [ ] 2.3. Airtable에 upsert
- [ ] 2.4. 검증: Airtable 레코드 수 확인

### Phase 3: 나라똔 12월 브랜드검색 데이터 입력

- [ ] 3.1. 12월 데이터 준비 (관리자 화면 기준)
  - PC: 노출 583, 클릭 339
  - 모바일: 노출 812, 클릭 537
- [ ] 3.2. Airtable에 월마감 데이터로 입력 (is_finalized = true)
- [ ] 3.3. 검증: 합계 확인 (노출 1,395, 클릭 876)

### Phase 4: 프론트엔드 API 수정

- [ ] 4.1. Airtable 조회 함수 작성
- [ ] 4.2. 기존 Supabase API를 Airtable로 전환
- [ ] 4.3. 나라똔 대시보드 안내문 추가

### Phase 5: 자동화

- [ ] 5.1. Vercel Cron 설정 (새벽 3시 KST)
- [ ] 5.2. 백필 스크립트 API 엔드포인트 생성
- [ ] 5.3. 텔레그램 알림 연동

---

## 나라똔 12월 브랜드검색 데이터 (월마감)

**기간**: 2025-12-01 ~ 2025-12-31

| 디바이스 | 노출 | 클릭 |
|---------|------|------|
| PC | 583 | 339 |
| 모바일 | 812 | 537 |
| **합계** | **1,395** | **876** |

**입력 방식**: 월별 합계로 1개 레코드 (date = 2025-12-31)

---

## 환경변수

```bash
# Airtable
AIRTABLE_API_KEY=patLrqsWWAheA6dVc.xxx

# H.E.A 판교
AIRTABLE_HEA_BASE_ID=appJlOqnadLsMJQYw
AIRTABLE_HEA_TABLE_ID=tbl8ftclEFG5ypohX

# 나라똔
AIRTABLE_NARATTON_BASE_ID=appN2KzUoORRrb8X9
AIRTABLE_NARATTON_TABLE_ID=tblmC9Ft2ioXKXsrL

# Cloudflare
CLOUDFLARE_API_TOKEN=_-UNLRYLi34TiE6wAWEC-fwcEvL01G2yPt-1YPIW
```

---

## 참고

- H.E.A 판교 Naver 데이터: 키워드 없는 백필은 자동, 키워드 포함 월마감은 수동
- 나라똔 Naver 데이터: 수동 입력만 (API 제한)
- 나라똔 대시보드: "네이버 브랜드검색 데이터는 월간 마감 후 업데이트됩니다" 안내문 필요
