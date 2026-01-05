# 다음 세션 요청문

## 복사해서 사용:
```
나라똔 프론트엔드에서 데이터 안 보이는 문제 확인.
API는 정상 (Meta 9,273/305, Naver 1,115/690).
프론트엔드 코드 확인 필요.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 🚨 현재 문제: 프론트엔드에서 데이터 안 보임

### 증상
- 프로덕션 https://report.polarad.co.kr/?client=naratton 접속
- **상호명 검색량 추이만 보임** (keywordStats)
- Meta, Naver 광고 데이터가 화면에 표시 안 됨

### API는 정상 ✅
```
GET /api/dashboard?client=naratton&period=30d

Meta: { impressions: 9273, clicks: 305, leads: 41, spend: 872 }
Naver: { impressions: 1115, clicks: 690, spend: 0 }
KPI: { totalImpressions: 10388, totalClicks: 995, totalLeads: 41 }
```

### 확인 필요
1. 프론트엔드 컴포넌트에서 API 응답 처리 확인
2. 조건부 렌더링 로직 확인 (데이터가 있어도 안 보이는 조건?)
3. 브라우저 콘솔 에러 확인

### 관련 파일 (추정)
- `dashboard/src/app/page.tsx` - 메인 대시보드 페이지
- `dashboard/src/components/` - KPI, 차트 컴포넌트들

---

## 이번 세션 완료 작업 ✅

### 1. Dashboard API Supabase → Airtable 전환
- 클라이언트 조회: `AIRTABLE_CONFIG` 직접 확인
- 네이버 데이터: Airtable (`naver_place`, `naver_brand_search`)

### 2. Vercel 환경변수 추가
```
AIRTABLE_API_KEY
AIRTABLE_HEA_BASE_ID / AIRTABLE_HEA_TABLE_ID
AIRTABLE_NARATTON_BASE_ID / AIRTABLE_NARATTON_TABLE_ID
```

### 3. H.E.A 판교 네이버 플레이스 데이터 Import
- 28일치, 총 노출 14,180 / 클릭 500 / 비용 917,477원

### 4. Airtable 버그 수정
- 페이지네이션 지원 (100개 이상 레코드)
- 날짜 필터 `<=` → `<` 연산자 우회 (12/31 누락 문제)

---

## 프로덕션 API 현재 상태 ✅

### H.E.A 판교
| 소스 | 노출수 | 클릭수 | 비용 |
|------|--------|--------|------|
| Meta | 124,051 | 4,021 | 721,500원 |
| Naver | 14,180 | 500 | 917,477원 |

### 나라똔
| 소스 | 노출수 | 클릭수 |
|------|--------|--------|
| Meta | 9,273 | 305 |
| Naver | 1,115 | 690 |

---

## 프로젝트 정보

- **경로**: `F:\polarad-meta`
- **GitHub**: `pola2025/report-polarad`
- **프로덕션**: https://report.polarad.co.kr
- **환경변수**: `dashboard/.env.local`

### Airtable
| 클라이언트 | Base ID | Table ID |
|-----------|---------|----------|
| H.E.A 판교 | appJlOqnadLsMJQYw | tbl8ftclEFG5ypohX |
| 나라똔 | appN2KzUoORRrb8X9 | tblmC9Ft2ioXKXsrL |
