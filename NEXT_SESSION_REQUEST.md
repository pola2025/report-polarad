# 다음 세션 요청문

## 복사해서 사용:
```
일별 성과추이 차트 개선 작업 계속.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 남은 작업

### 1. 툴팁(모달) 텍스트 색상 지표별로 맞추기
- **현재**: 모든 텍스트가 진회색(#374151)
- **변경**: 각 지표 색상에 맞게
  - 지출액: 파란색 (#3B82F6)
  - 노출수: 녹색 (#03C75A)
  - 리드수: 보라색 (#8B5CF6)
- **대상**: H.E.A 판교, 나라똔 모두

### 2. Meta / Naver 차트 분리
- **현재**: "일별 성과 추이" 하나만 있어서 Meta인지 Naver인지 불분명
- **변경**:
  - "Meta 일별 성과 추이" 차트
  - "Naver 일별 성과 추이" 차트
  - 각각 별도로 표시

### 3. 클라이언트별 차트 구성

| 클라이언트 | Meta 차트 | Naver 차트 |
|-----------|----------|-----------|
| H.E.A 판교 | 지출액 + 노출수 | 지출액 + 노출수 |
| 나라똔 | 지출액 + 노출수 + 리드수 | 지출액 + 노출수 |

---

## 완료된 작업 (2025-01-06)

### Supabase → Airtable 이관 100% 완료
- `/api/admin/clients` - Airtable 연동
- `/api/naver/brand-search` - Airtable 연동
- `/api/admin/upload/naver` - Airtable 연동
- `/api/admin/upload/brand-search` - Airtable 연동
- `/api/naver/analytics` - Airtable 연동
- `/api/admin/keywords` - Airtable 연동

### API 개선
- UUID/slug 모두 지원 (`naratton`, `hea-pangyo` 직접 사용 가능)

### DailyTrendChart 통합 뷰 추가
- 지출액(막대, 파란색) + 노출수(선, 녹색) 동시 표시
- 나라똔: 리드수(선, 보라색) 별도 Y축으로 추가
- 통합/개별 뷰 전환 기능

---

## 현재 커밋 내역
```
f46e769 feat: 차트 색상 및 리드수 별도 Y축 추가
85f0c2f fix: 툴팁 텍스트 색상 수정 (흰색 → 진회색)
5276793 feat: 대시보드 통합요약에 Meta 일별추이 차트 추가
e3f5d54 feat: Meta 일별추이 차트 통합 뷰 추가
8e15562 feat: API에서 UUID/slug 모두 지원
84302f5 feat: Airtable keyword_stats 테이블 연동 완료
```

---

## 프로젝트 정보

- **경로**: F:\polarad-meta
- **GitHub**: https://github.com/pola2025/report-polarad
- **프로덕션**: https://report.polarad.co.kr
- **환경변수**: dashboard/.env.local

### 주요 파일
- `dashboard/src/components/report/DailyTrendChart.tsx` - 일별추이 차트 컴포넌트
- `dashboard/src/app/page.tsx` - 대시보드 메인 페이지
