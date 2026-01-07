# 다음 세션 요청문

## 복사해서 사용:
```
나라똔 월간 리포트 지출액 이중 환산 버그 수정해줘.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 🚨 긴급 버그: 지출액 이중 환산

### 문제 현상
| 항목 | 리포트 표시 | 실제 값 | 원인 |
|------|------------|---------|------|
| 총 지출 | ₩1,784,625,000 (17억) | ₩1,189,750 (119만) | 이중 환산 |
| CPC | ₩9,914,583 | ~₩6,600 | 이중 환산 |

### 원인
- 나라똔 Airtable 데이터: **이미 KRW로 저장됨** (spend: 1,189,750)
- API route에서 **다시 USD_TO_KRW(1500) 곱함**
- 결과: 1,189,750 × 1500 = 1,784,625,000

### 문제 파일
`dashboard/src/app/api/reports/monthly/[id]/route.ts`

```typescript
// 문제 코드 (180행)
spend: c.spend * USD_TO_KRW,  // campaigns

// 문제 코드 (259행)
spend: ((meta?.spend || 0) * USD_TO_KRW) + (naver?.totalCost || 0),  // daily

// 문제 코드 (267행)
metaSpend: (meta?.spend || 0) * USD_TO_KRW,
```

### 해결 방안
1. **클라이언트별 분기**: 나라똔(naratton)인 경우 USD_TO_KRW 곱하지 않기
2. **또는** Airtable에 currency 필드 추가하여 동적 처리

### 수정 예시
```typescript
const clientSlug = client?.slug || getClientSlugById(report.client_id)
const isKrwClient = clientSlug === 'naratton'  // 나라똔은 KRW로 저장됨
const exchangeRate = isKrwClient ? 1 : USD_TO_KRW

// 사용
spend: c.spend * exchangeRate,
```

---

## ✅ 이번 세션 완료 작업

### 커밋: `253c12c`

1. **API route 수정** - 네이버 필터링 `naver_place` → `naver_*` (나라똔 브랜드검색 포함)
2. **일별 성과 추이** - 클릭수 선 그래프 추가
3. **채널별 성과 분석** - 영상조회수, 평균시청시간 추가
4. **요일별 성과 패턴** - 클릭→조회→리드 순서, 리드 중심 인사이트
5. **날짜별 성과 패턴** - 리드 행 추가 (히트맵)
6. **Meta Top5** - 리드 컬럼 추가

---

## 🔧 다음 세션 작업

### 1. [긴급] 지출액 이중 환산 버그 수정
- `route.ts`에서 나라똔 클라이언트 분기 처리
- 나라똔: exchangeRate = 1
- H.E.A 판교: exchangeRate = 1500 (USD_TO_KRW)

### 2. Playwright 검증 재실행
- 수정 후 리포트 데이터 정합성 확인
- 나라똔 월간 리포트 ID: `0f2e1dba-c87f-43ce-b27f-bb463db51759`
- URL: https://report.polarad.co.kr/report/monthly/0f2e1dba-c87f-43ce-b27f-bb463db51759

### 3. 데이터 검증 기준
| 항목 | 기대값 |
|------|--------|
| 총 노출 | 5,343 + 1,395 = 6,738 |
| 총 클릭 | 180 + 876 = 1,056 |
| 총 지출 | ~₩1,189,750 (Meta만) |
| 리드수 | 23건 |

---

## 클라이언트별 데이터 형식 (중요!)

| 클라이언트 | spend 저장 형식 | API 처리 |
|-----------|----------------|----------|
| H.E.A 판교 | USD | × 1500 필요 |
| 나라똔 | KRW | × 1 (그대로) |

---

## 클라이언트별 Airtable 정보

| 클라이언트 | Base ID | Table ID |
|-----------|---------|----------|
| H.E.A 판교 | `appJlOqnadLsMJQYw` | `tbl8ftclEFG5ypohX` |
| 나라똔 | `appN2KzUoORRrb8X9` | `tblmC9Ft2ioXKXsrL` |

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 로컬 경로 | `F:\polarad-meta` |
| 대시보드 | `F:\polarad-meta\dashboard` |
| GitHub | `github-pola2025:pola2025/report-polarad.git` |
| 프로덕션 URL | https://report.polarad.co.kr |
| 환경변수 | `dashboard/.env.local` |

---

## 🚨 필수 주의사항

### H.E.A 판교 데이터 보호
- ❌ HEA 판교 데이터 절대 건드리지 않음
- ❌ HEA 판교 환산 로직 변경 금지 (USD → KRW 유지)

### 데이터 소스
- **Airtable 전용** - Supabase 사용 금지
