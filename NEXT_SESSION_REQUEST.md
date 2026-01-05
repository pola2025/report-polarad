# 다음 세션 요청문

## 복사해서 사용:
```
나라똔 데이터 연결 확인 및 Airtable CLI로 클라이언트 테이블 완전 이관.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## ✅ 이번 세션 완료 작업

1. **나라똔 slug 문제 해결**
   - Supabase에서 `나라똔` → `naratton`으로 slug 업데이트
   - `airtable.ts`에 한글 `나라똔` slug 지원 추가

2. **Supabase 의존성 제거**
   - `/api/admin/clients` 하드코딩으로 변경
   - 클라이언트 목록 API가 더 이상 Supabase 호출 안 함

3. **배포 완료**
   - 빌드 성공, git push 완료
   - Vercel 자동 배포됨

---

## 📋 다음 세션 작업

- [ ] Airtable CLI로 클라이언트 테이블 생성 (사용자 요청)
- [ ] 클라이언트 목록을 Airtable에서 가져오도록 변경
- [ ] 나라똔 대시보드 데이터 정상 표시 최종 확인

---

## 현재 데이터 소스 구조

```
클라이언트 목록 → 코드 하드코딩 (CLIENTS 배열)
                  파일: /api/admin/clients/route.ts

광고 데이터 → Airtable
  - H.E.A 판교: appJlOqnadLsMJQYw / tbl8ftclEFG5ypohX
  - 나라똔: appN2KzUoORRrb8X9 / tblmC9Ft2ioXKXsrL
```

---

## 클라이언트 정보

| 클라이언트 | slug | client_type | naver_type | naver_fixed_budget |
|-----------|------|-------------|------------|-------------------|
| H.E.A 판교 | hea-pangyo | restaurant | place | null |
| 나라똔 | naratton | consulting | brand_search | 1,320,000원 |

---

## 환경변수 (dashboard/.env.local)

```
AIRTABLE_API_KEY=patLrqsWWAheA6dVc...
AIRTABLE_HEA_BASE_ID=appJlOqnadLsMJQYw
AIRTABLE_HEA_TABLE_ID=tbl8ftclEFG5ypohX
AIRTABLE_NARATTON_BASE_ID=appN2KzUoORRrb8X9
AIRTABLE_NARATTON_TABLE_ID=tblmC9Ft2ioXKXsrL
```

---

## 프로젝트 정보

- **경로**: F:\polarad-meta
- **GitHub**: https://github.com/pola2025/report-polarad
- **프로덕션**: https://report.polarad.co.kr
- **나라똔 URL**: https://report.polarad.co.kr/?client=naratton
