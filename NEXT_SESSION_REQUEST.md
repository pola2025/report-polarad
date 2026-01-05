# 다음 세션 요청문

## 복사해서 사용:
```
브랜드검색 대시보드 수정 계속 진행해줘.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 이번 세션 완료 작업 (2026-01-05)

### 1. 브랜드검색 CSV 업로드 테스트 ✅
- 나라똔 클라이언트 naver_enabled, naver_show_detail_tab 활성화
- Admin clients API에 naver_type 등 필드 추가
- CSV 업로드 테스트 성공 (10건)

### 2. 브랜드검색 데이터 fetch 수정 ✅
- activeTab 조건 제거 → 통합 요약 탭에서도 브랜드검색 데이터 로드

### 3. 통합 KPI 수정 (진행 중)
- 브랜드검색 데이터를 통합 KPI에 합산하는 로직 추가 중
- KPI 카드에 인라인 계산 로직 적용함

---

## 다음 세션 작업

### 1. [진행 중] 통합 KPI 브랜드검색 합산 완료
- 현재 KPI 카드에 인라인 계산 로직 적용됨
- 빌드 테스트 및 화면 확인 필요
- **파일**: `dashboard/src/app/page.tsx` (626~698행)

### 2. [대기] 네이버 상세 탭 복원
- 상단 탭에 "네이버 상세" 탭 추가 필요
- 브랜드검색 타입 클라이언트용 네이버 상세 화면 구성
- **참고**: 588~604행 탭 네비게이션, 1469행 이후 네이버 상세 탭 내용

### 3. [중요] 데이터 정합성 확인
- 사용자 피드백: "1일부터 5일 데이터 노출수치가 실제 값과 다름"
- 사용자 피드백: "네이버 1월1일 노출수가 3천회가 아님"
- **테스트 CSV 데이터 (1월 1일)**:
  - PC: 1,250 + Mobile: 2,340 = **3,590** (정상)
- 테스트 데이터 합계 (17,750) vs 대시보드 표시 (18,865) 불일치
- **확인 필요**: DB 데이터, API 응답, 대시보드 표시 3단계 비교
- 날짜 범위 또는 중복 데이터 문제 가능성

### 4. [대기] 네이버 일별 추이 차트 X축 순서 수정
- 현재 X축이 역순으로 표시됨 (01-03, 12-31, ... 12-07)
- 정상 순서로 정렬 필요

---

## 프로젝트 정보

- **경로**: `F:\polarad-meta`
- **대시보드**: `F:\polarad-meta\dashboard`
- **로컬 포트**: 3001 (3000 사용 중일 때)
- **프로덕션**: https://report.polarad.co.kr
- **Supabase**: https://supabase.com/dashboard/project/mpljqcuqrrfwzamfyxnz

### 나라똔 클라이언트 정보
| 항목 | 값 |
|------|-----|
| UUID | `c2f60730-f8c1-4361-b9fc-3b44725c3955` |
| slug | `나라똔` |
| naver_type | `brand_search` |
| naver_enabled | `true` |
| naver_show_detail_tab | `true` |
| naver_fixed_budget | `1,320,000원` |

### 브랜드검색 관련 파일
```
dashboard/src/app/page.tsx                             # 메인 대시보드 (수정 중)
dashboard/src/app/api/client/route.ts                  # 클라이언트 API
dashboard/src/app/api/admin/clients/route.ts           # Admin 클라이언트 API
dashboard/src/app/api/naver/brand-search/route.ts      # 브랜드검색 조회 API
dashboard/src/app/admin/upload/brand-search/page.tsx   # 업로드 페이지
```

### DB 테이블
- `polarad_clients`: naver_type, naver_enabled, naver_fixed_budget 등
- `polarad_brand_search_data`: 브랜드검색 일별 데이터

---

## 주요 코드 위치 (page.tsx)

| 기능 | 행 번호 |
|------|---------|
| 통합 KPI 요약 | 618~698 |
| 광고비 상세 테이블 | 700~900 |
| 채널별 성과 비교 차트 | 1000~1100 |
| 네이버 브랜드검색 성과 카드 | 1067~1127 |
| 네이버 일별 추이 차트 | 1179~1210 |
| 네이버 상세 탭 | 1455~1470 |

---

## 커밋 히스토리

| 커밋 | 내용 |
|------|------|
| ae02a8c | fix: 브랜드검색 데이터 조회 버그 수정 |
| af7c4af | feat: 브랜드검색 대시보드 통합 및 Admin 개선 |

---

## 주의사항

1. **개발 서버 포트**: 3000이 사용 중이면 3001로 자동 변경됨
2. **API 캐시**: Next.js 캐시 문제 시 `.next/cache` 삭제 후 재시작
3. **브랜드검색 데이터**: 1월 1~5일 데이터만 있음 (테스트 데이터)
