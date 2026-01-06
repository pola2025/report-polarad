# 다음 세션 요청문

## 복사해서 사용:
```
나라똔 12월 Meta 데이터 재백필 필요.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 🚨 긴급 작업: 나라똔 12월 Meta 재백필

### 문제 상황
| 항목 | Meta API 실제 | Airtable 저장 | 차이 |
|------|---------------|---------------|------|
| 지출 | **$798 USD** (119만원) | 386원 | ❌ 심각 |
| 노출 | 5,288 | 2,501 | ❌ 누락 |

### 원인
- 백필 시 데이터가 불완전하게 저장됨
- spend 값이 USD → 원화 환산 없이 잘못 저장

### 해결 방법
1. 나라똔 Airtable에서 12월 Meta 데이터 삭제
2. 12월 전체 재백필 실행

### 백필 명령어
```bash
cd scripts
node backfill-airtable.js --client "나라똔" --start 2025-12-01 --end 2025-12-31
```

---

## 🚨 필수 주의사항

### H.E.A 판교 데이터 보호
- ❌ HEA 판교 데이터 절대 건드리지 않음
- ❌ HEA 판교 Airtable (`appJlOqnadLsMJQYw`) 접근 금지

### 나라똔 작업 시
- ✅ 나라똔 전용 Airtable만 사용: `appN2KzUoORRrb8X9` / `tblmC9Ft2ioXKXsrL`
- ✅ CLIENT 환경변수 반드시 "나라똔"으로 설정

---

## 이번 세션 완료 작업

### 1. 리드수 차트 색상 수정 ✅
- 리드수 색상: 보라색 → 빨간색 (#EF4444)
- 리드수 Y축: 숨김 처리
- 그래프 선 + 요약 카드 모두 빨간색 통일

### 2. Meta 광고 성과에 리드수 추가 ✅
- MetaSummaryCards에 리드수 메트릭 추가
- 6개 메트릭: 노출수, 클릭수, 리드수, CTR, 지출액, CPC

### 3. 브랜드검색 CSV 파서 개선 ✅
- 4열 형식 지원 추가 (광고그룹,일별,노출수,클릭수)
- 네이버 광고그룹 보고서 형식 호환

### 4. 나라똔 12월 브랜드검색 업로드 ✅
- 57개 레코드 업로드 완료
- 노출: 1,395 / 클릭: 876

### 5. 나라똔 1월 1일 Meta 백필 ✅
- 2개 레코드 추가

---

## 다음 세션 작업

### 1. [긴급] 나라똔 12월 Meta 재백필
- 기존 12월 Meta 데이터 삭제
- 12월 전체 재백필 실행
- 데이터 검증 (API vs Airtable 비교)

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
