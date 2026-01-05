# Meta Ads OAuth 인증 시스템 구현 요청

## 프로젝트 경로
`F:\polarad-meta`

## PRD 문서
`F:\polarad-meta\docs\PRD-OAuth-Integration.md` 참고

---

## 요청 내용

### 목표
현재 수동 토큰 관리 방식을 OAuth 기반으로 전환하고, 관리자 승인 시스템을 구축해주세요.

### 배경
- 현재: 토큰을 수동으로 발급받아 환경변수에 저장
- 목표: Meta 앱 검수 통과를 위한 OAuth 로그인 플로우 구현
- 비즈니스: 유료 서비스이므로 관리자 승인 후에만 서비스 활성화

### 필요한 권한
- `ads_read` 만 필요 (instagram 권한 불필요)

---

## 구현 요구사항

### 1. OAuth 인증 플로우
```
/api/auth/login    - Meta OAuth 시작 (리다이렉트)
/api/auth/callback - 콜백 처리, 토큰 저장, pending 상태로 등록
/api/auth/refresh  - 토큰 갱신 (active 상태만)
/api/auth/status   - 토큰 유효성 확인
```

### 2. 관리자 승인 시스템
```
클라이언트 상태:
- pending: OAuth 완료, 승인 대기 (서비스 비활성)
- active: 관리자 승인 완료 (서비스 활성)
- suspended: 일시 중지 - 미납 등 (서비스 비활성)
- expired: 계약 만료 (서비스 비활성)

API:
GET  /api/admin/clients          - 클라이언트 목록 (상태별 필터)
POST /api/admin/clients/approve  - 승인 처리
POST /api/admin/clients/suspend  - 일시 중지
POST /api/admin/clients/activate - 재활성화
```

### 3. UI 페이지
```
/login   - Meta 로그인 버튼
/pending - 승인 대기 안내 페이지 (OAuth 후 pending 상태일 때)
/admin/clients - 관리자용 클라이언트 관리 페이지
```

### 4. DB 스키마 변경
```sql
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS
  -- OAuth 토큰 관련
  meta_token_expires_at TIMESTAMP WITH TIME ZONE,
  meta_user_id VARCHAR(50),
  meta_token_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 클라이언트 승인 상태 관련
  status VARCHAR(20) DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(100),
  contract_start_date DATE,
  contract_end_date DATE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  suspension_reason TEXT;
```

### 5. 텔레그램 알림
- 신규 OAuth 인증 시 관리자에게 알림
- 토큰 만료 임박 시 알림

### 6. 환경변수
```env
# 기존 유지
META_APP_ID=xxx
META_APP_SECRET=xxx
TOKEN_ENCRYPTION_KEY=xxx

# 신규 추가
NEXT_PUBLIC_META_REDIRECT_URI=https://도메인/api/auth/callback
```

---

## 파일 구조

```
dashboard/src/
├── app/
│   ├── login/page.tsx              # 로그인 페이지
│   ├── pending/page.tsx            # 승인 대기 안내
│   ├── admin/clients/page.tsx      # 관리자 클라이언트 관리
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── callback/route.ts
│       │   ├── refresh/route.ts
│       │   └── status/route.ts
│       └── admin/clients/
│           ├── route.ts            # GET 목록
│           ├── approve/route.ts
│           ├── suspend/route.ts
│           └── activate/route.ts
└── lib/
    ├── meta-oauth.ts               # OAuth 유틸리티
    └── client-status.ts            # 상태 관리 유틸리티
```

---

## 플로우 요약

### 클라이언트 플로우
```
1. /login 접속 → Meta 로그인 버튼 클릭
2. Meta OAuth 화면 → 권한 승인
3. /api/auth/callback → 토큰 저장, pending 상태
4. /pending 페이지로 리다이렉트 → "승인 대기 중" 안내
5. 관리자 승인 후 → active 상태
6. 대시보드 접근 가능
```

### 관리자 플로우
```
1. 텔레그램 알림 수신 (신규 OAuth 인증)
2. /admin/clients 접속
3. pending 클라이언트 확인
4. 계약/결제 확인 후 승인 버튼 클릭
5. 클라이언트 active 상태로 변경
```

---

## 주의사항

1. **토큰 보안**: Access Token은 반드시 암호화 저장 (기존 TOKEN_ENCRYPTION_KEY 활용)
2. **상태 체크**: API 호출 전 클라이언트 상태가 active인지 확인
3. **CSRF 방지**: OAuth state 파라미터 사용
4. **기존 기능 유지**: 대시보드, 리포트 등 기존 기능은 변경 없이 유지

---

## 테스트 시나리오

1. OAuth 로그인 → pending 상태 확인
2. 관리자 승인 → active 상태 변경 확인
3. active 클라이언트 → 대시보드 접근 가능 확인
4. suspended 클라이언트 → 대시보드 접근 차단 확인
5. 토큰 갱신 정상 작동 확인

---

## 구현 순서 권장

1. DB 마이그레이션 먼저
2. OAuth API 엔드포인트
3. 관리자 API 엔드포인트
4. UI 페이지들
5. 텔레그램 알림 연동
6. 테스트
