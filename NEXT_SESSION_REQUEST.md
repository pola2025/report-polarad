# 다음 세션 요청문

## 복사해서 사용:
```
애널리틱스 Airtable 연동 마무리.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## ✅ 이번 세션 완료 작업

1. **Airtable 클라이언트 테이블 생성**
   - Base: `appC3XKBcYgZBTETn`
   - Table: `tblwQBbsMyg00qi8F`
   - URL: https://airtable.com/appC3XKBcYgZBTETn/tblwQBbsMyg00qi8F

2. **필드 생성 (Airtable CLI)**
   - id, client_id, slug, client_type, is_active, status
   - naver_type, naver_enabled, naver_fixed_budget
   - telegram_enabled, telegram_chat_id, meta_ad_account_id
   - service_start_date, service_end_date

3. **클라이언트 데이터 입력**
   - H.E.A 판교 (hea-pangyo)
   - 나라똔 (naratton)

4. **API Airtable 연동**
   - `/api/admin/clients` GET → Airtable 조회
   - `/api/admin/clients` POST → Airtable에 새 클라이언트 생성
   - `/api/admin/clients` PUT → Airtable 클라이언트 수정
   - 응답에 `airtable_record_id` 포함 (수정 시 필요)

5. **배포 완료**

---

## 📋 다음 세션 작업

- [ ] 애널리틱스 API Airtable 연동 확인/완료
- [ ] 기타 Supabase 의존성 제거 확인
- [ ] 대시보드에서 클라이언트 추가/수정 UI 테스트

---

## 현재 데이터 소스 구조

```
클라이언트 목록 → Airtable (appC3XKBcYgZBTETn/tblwQBbsMyg00qi8F)
                  ✅ GET/POST/PUT 모두 Airtable 연동됨

광고 데이터 → Airtable (기존 유지)
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

## 프로젝트 정보

- **경로**: F:\polarad-meta
- **GitHub**: https://github.com/pola2025/report-polarad
- **프로덕션**: https://report.polarad.co.kr
- **나라똔 URL**: https://report.polarad.co.kr/?client=naratton
- **환경변수**: dashboard/.env.local
