# 다음 세션 요청문

## 복사해서 사용:
```
나라똔 브랜드검색 대시보드 확인 및 배포해줘.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 이번 세션 완료 작업 (2026-01-05)

### 나라똔 클라이언트 브랜드검색 전환
- **naver_type 필드 추가**: Supabase `polarad_clients` 테이블에 컬럼 추가 완료
- **나라똔 설정**: `naver_type = 'brand_search'` 설정 완료

### 코드 수정 완료
1. **supabase.ts** - `NaverType` 타입 추가, `PolaradClient`에 `naver_type` 필드 추가
2. **/api/client/route.ts** - `naver_type` 반환 추가
3. **page.tsx** - clientInfo에 naverType 추가, 조건부 렌더링 적용
4. **NaverPeriodTable.tsx** - naverType prop 추가, 안내 문구 조건부 변경
5. **BrandSearchTable.tsx** (신규) - 브랜드검색용 컴포넌트 생성 (미사용)

### 나라똔(브랜드검색) UI 변경사항
- 통합요약: "네이버 플레이스 광고 성과" → "네이버 브랜드검색 광고 성과"
- 네이버 상세 탭에서 숨김:
  - 평균 순위 카드
  - 고유 키워드 카드
  - 키워드별 광고비 분포 차트
  - 키워드별 성과 분석 테이블
- 안내 문구: "월 예산: PC 66만원 + 모바일 66만원 = 132만원" 표시

---

## 다음 세션 작업

### 1. 로컬 테스트
```bash
cd F:\polarad-meta\dashboard
npm run dev
```
- http://localhost:3000/?client=나라똔 접속
- 브랜드검색 UI 확인 (위 변경사항 적용 여부)

### 2. Vercel 배포
- 변경사항 커밋 및 푸시
- 프로덕션 확인: https://report.polarad.co.kr/?client=나라똔

### 3. 브랜드검색 데이터 입력 (사용자)
- admin에서 상호명 검색 통계처럼 직접 입력
- CSV 파일 위치: `c:\Users\flame\Downloads\캠페인 보고서,705lsy_naver.csv`
- 데이터 구조: 일별 PC/모바일 노출수, 클릭수

---

## 프로젝트 정보

- **경로**: `F:\polarad-meta`
- **대시보드**: `F:\polarad-meta\dashboard`
- **프로덕션 URL**: https://report.polarad.co.kr
- **Supabase**: https://supabase.com/dashboard/project/mpljqcuqrrfwzamfyxnz

### 클라이언트 정보
| 클라이언트 | UUID | slug | naver_type |
|-----------|------|------|------------|
| H.E.A 판교 | 3ff2896e-6786-4936-9c57-311f69f43c63 | hea-pangyo | place |
| 나라똔 | c2f60730-f8c1-4361-b9fc-3b44725c3955 | 나라똔 | brand_search |

### 나라똔 네이버 API (참고용)
- CUSTOMER_ID: 4174377
- ACCESS_LICENSE: 010000000043d73b04da4a56a09720b6677de3b600fc43c0e0ceb3730b1c0cf312f88672cb
- SECRET_KEY: AQAAAABD1zsE2kpWoJcgtmd947YAuvB89kXJ41PYVJq3zQLgpQ==

---

## 빌드 상태
- 로컬 빌드: ✅ 성공
- 배포: ❌ 미완료
