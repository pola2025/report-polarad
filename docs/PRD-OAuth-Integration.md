# PRD: Meta Ads OAuth 인증 시스템

## 문서 정보
- **작성일**: 2024-12-17
- **버전**: 1.0
- **상태**: Draft
- **프로젝트**: polarad-meta, bas_meta

---

## 1. 개요

### 1.1 배경
현재 Meta Ads API 토큰을 수동으로 발급받아 환경변수에 저장하는 방식으로 운영 중입니다. Meta 앱 검수를 통과하고 Rate Limit을 늘리기 위해 OAuth 기반 인증 시스템으로 전환이 필요합니다.

### 1.2 목표
- Meta 앱 검수 통과를 위한 OAuth 로그인 플로우 구현
- 클라이언트(광고주)가 직접 Meta 계정으로 로그인하여 권한 부여
- 토큰 자동 발급 및 갱신 시스템 구축

### 1.3 범위
- **In Scope**: OAuth 로그인, 토큰 관리, 콜백 처리
- **Out of Scope**: 기존 대시보드 UI, 데이터 수집 로직, 리포트 생성 (변경 없음)

---

## 2. 현재 상태 분석

### 2.1 현재 아키텍처
```
[관리자] → 수동 토큰 발급 → [환경변수/.env] → [API 호출]
```

### 2.2 현재 사용 중인 API
| 엔드포인트 | 용도 |
|-----------|------|
| `/{ad_account_id}/insights` | 광고 인사이트 조회 |
| `/{ad_account_id}/ads` | 광고 목록 조회 |
| `/oauth/access_token` | 토큰 갱신 |

### 2.3 현재 토큰 관리
- `META_ACCESS_TOKEN`: 환경변수에 수동 저장
- `META_AD_ACCOUNT_ID`: 환경변수에 수동 저장
- 토큰 만료 시 수동으로 재발급 필요

---

## 3. 목표 아키텍처

### 3.1 OAuth 플로우
```
[클라이언트] → 로그인 버튼 클릭
     ↓
[Meta OAuth] → 권한 승인 화면
     ↓
[Callback] → Authorization Code 수신
     ↓
[서버] → Access Token 교환 및 저장
     ↓
[DB] → 클라이언트별 토큰 저장
     ↓
[API 호출] → 저장된 토큰으로 데이터 수집
```

### 3.2 토큰 저장 구조
```sql
-- clients 테이블에 추가 또는 별도 테이블
meta_access_token      VARCHAR   -- 액세스 토큰 (암호화)
meta_token_expires_at  TIMESTAMP -- 만료 시간
meta_ad_account_id     VARCHAR   -- 광고 계정 ID
meta_user_id           VARCHAR   -- Meta 사용자 ID
```

---

## 4. 기능 요구사항

### 4.0 클라이언트 승인 시스템 (관리자 기능)

> **중요**: 유료 서비스이므로 OAuth 인증만으로 서비스가 활성화되면 안 됨.
> 관리자가 승인한 클라이언트만 데이터 수집 및 대시보드 접근 가능.

#### 4.0.1 승인 플로우
```
[클라이언트 OAuth 인증] → [대기 상태로 등록]
        ↓
[관리자 확인] → 계약/결제 확인
        ↓
[승인 처리] → 서비스 활성화
        ↓
[데이터 수집 시작]
```

#### 4.0.2 클라이언트 상태
| 상태 | 설명 | 서비스 |
|------|------|--------|
| `pending` | OAuth 완료, 승인 대기 | ❌ 비활성 |
| `active` | 관리자 승인 완료 | ✅ 활성 |
| `suspended` | 일시 중지 (미납 등) | ❌ 비활성 |
| `expired` | 계약 만료 | ❌ 비활성 |

#### 4.0.3 관리자 대시보드 기능
- [ ] 신규 OAuth 인증 클라이언트 목록 확인
- [ ] 클라이언트 승인/거절 처리
- [ ] 서비스 활성화/비활성화 토글
- [ ] 계약 기간 설정
- [ ] 텔레그램 알림 (신규 인증 시)

#### 4.0.4 API 엔드포인트
```
GET  /api/admin/clients          # 클라이언트 목록 (상태별 필터)
POST /api/admin/clients/approve  # 승인 처리
POST /api/admin/clients/suspend  # 일시 중지
POST /api/admin/clients/activate # 재활성화
```

### 4.1 로그인 페이지 (`/login`)
- [ ] Meta 로그인 버튼 표시
- [ ] 로그인 상태에 따른 UI 분기
- [ ] 에러 메시지 표시 (권한 거부 등)

### 4.2 OAuth 콜백 (`/api/auth/callback`)
- [ ] Authorization Code 수신
- [ ] Access Token 교환
- [ ] Long-lived Token으로 변환 (60일 유효)
- [ ] 토큰 암호화 후 DB 저장
- [ ] 광고 계정 ID 자동 조회 및 저장

### 4.3 토큰 갱신 (`/api/auth/refresh`)
- [ ] 만료 임박 토큰 자동 갱신
- [ ] 갱신 실패 시 알림 (텔레그램)
- [ ] 갱신 로그 기록

### 4.4 토큰 상태 확인 (`/api/auth/status`)
- [ ] 토큰 유효성 검사
- [ ] 만료 예정 알림
- [ ] 권한 범위 확인

---

## 5. 기술 스펙

### 5.1 필요한 Meta 권한
| 권한 | 필요 여부 | 용도 |
|------|----------|------|
| `ads_read` | **필수** | 광고 데이터 읽기 |
| `ads_management` | 선택 | 광고 관리 (현재 미사용) |
| `instagram_basic` | **불필요** | 사용 안 함 |
| `instagram_manage_insights` | **불필요** | 사용 안 함 |

### 5.2 OAuth URL 구성
```
Authorization URL:
https://www.facebook.com/v22.0/dialog/oauth
  ?client_id={APP_ID}
  &redirect_uri={CALLBACK_URL}
  &scope=ads_read
  &state={CSRF_TOKEN}

Token Exchange URL:
https://graph.facebook.com/v22.0/oauth/access_token
  ?client_id={APP_ID}
  &client_secret={APP_SECRET}
  &redirect_uri={CALLBACK_URL}
  &code={AUTH_CODE}
```

### 5.3 환경변수
```env
# Meta App 설정 (기존 유지)
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret

# OAuth 설정 (신규)
NEXT_PUBLIC_META_REDIRECT_URI=https://your-domain.com/api/auth/callback
TOKEN_ENCRYPTION_KEY=your_32_byte_key  # 이미 존재
```

### 5.4 리다이렉트 URI (Meta 앱 설정)
```
# polarad-meta
https://report.polarad.co.kr/api/auth/callback

# bas_meta (추후)
https://bas-meta-ads.vercel.app/api/auth/callback
```

---

## 6. 파일 구조

### 6.1 신규 파일
```
polarad-meta/dashboard/
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx              # 클라이언트 로그인 페이지
│   │   ├── pending/
│   │   │   └── page.tsx              # 승인 대기 안내 페이지
│   │   ├── admin/
│   │   │   └── clients/
│   │   │       └── page.tsx          # 클라이언트 관리 페이지 (관리자)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/
│   │       │   │   └── route.ts      # OAuth 시작
│   │       │   ├── callback/
│   │       │   │   └── route.ts      # 콜백 처리
│   │       │   ├── refresh/
│   │       │   │   └── route.ts      # 토큰 갱신
│   │       │   └── status/
│   │       │       └── route.ts      # 상태 확인
│   │       └── admin/
│   │           └── clients/
│   │               ├── route.ts      # 클라이언트 목록 조회
│   │               ├── approve/
│   │               │   └── route.ts  # 승인 처리
│   │               ├── suspend/
│   │               │   └── route.ts  # 일시 중지
│   │               └── activate/
│   │                   └── route.ts  # 재활성화
│   └── lib/
│       ├── meta-oauth.ts             # OAuth 유틸리티
│       └── client-status.ts          # 상태 관리 유틸리티
```

### 6.2 수정 파일
```
- .env.local.example  # 환경변수 추가
- lib/supabase.ts     # 토큰 조회 로직 추가 (필요시)
```

---

## 7. 데이터베이스 변경

### 7.1 기존 테이블 수정 (polarad_clients)
```sql
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS
  -- OAuth 토큰 관련
  meta_token_expires_at TIMESTAMP WITH TIME ZONE,
  meta_user_id VARCHAR(50),
  meta_token_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 클라이언트 승인 상태 관련
  status VARCHAR(20) DEFAULT 'pending',  -- pending, active, suspended, expired
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(100),
  contract_start_date DATE,
  contract_end_date DATE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  suspension_reason TEXT;

-- 상태 체크 제약조건
ALTER TABLE polarad_clients
  ADD CONSTRAINT valid_status
  CHECK (status IN ('pending', 'active', 'suspended', 'expired'));
```

### 7.2 또는 별도 테이블 생성
```sql
CREATE TABLE IF NOT EXISTS meta_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES polarad_clients(id),
  access_token TEXT NOT NULL,  -- 암호화됨
  expires_at TIMESTAMP WITH TIME ZONE,
  ad_account_id VARCHAR(50),
  user_id VARCHAR(50),
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 8. 보안 요구사항

### 8.1 토큰 보안
- [ ] Access Token은 반드시 암호화하여 저장
- [ ] 기존 `TOKEN_ENCRYPTION_KEY` 활용
- [ ] 클라이언트에 토큰 노출 금지

### 8.2 CSRF 방지
- [ ] OAuth state 파라미터 사용
- [ ] state 값 검증

### 8.3 권한 검증
- [ ] 콜백 시 granted scope 확인
- [ ] 필수 권한 누락 시 에러 처리

---

## 9. Meta 앱 검수 준비

### 9.1 앱 설정 (Meta 개발자 콘솔)
- [ ] 유효한 OAuth 리디렉션 URI 등록
- [ ] 앱 도메인 설정
- [ ] 개인정보처리방침 URL 등록
- [ ] 서비스 약관 URL 등록

### 9.2 검수 제출물
- [ ] 스크린캐스트: OAuth 로그인 → 데이터 표시 과정
- [ ] 앱 사용 목적 설명
- [ ] 데이터 사용 방식 설명

### 9.3 검수 시 설명할 내용
```
"이 앱은 광고주가 자신의 Meta 광고 계정 데이터를 분석하고
리포트를 생성하는 서비스입니다.

주요 기능:
1. 광고 성과 대시보드 (노출, 클릭, 리드, CPL)
2. 광고별 상세 분석
3. 주간/월간 리포트 자동 생성

사용하는 권한:
- ads_read: 광고 인사이트 데이터 조회에 사용

데이터 처리:
- 사용자 동의 하에 광고 데이터만 수집
- 개인정보는 수집하지 않음
- 데이터는 분석 및 리포트 생성에만 사용"
```

---

## 10. 구현 순서

### Phase 1: DB 스키마 & 기본 OAuth (1일)
1. DB 마이그레이션 (status 필드 추가)
2. `/api/auth/login` - OAuth 시작점
3. `/api/auth/callback` - 콜백 처리, pending 상태로 저장
4. 토큰 암호화 및 DB 저장

### Phase 2: 관리자 승인 시스템 (1일)
1. `/api/admin/clients` - 클라이언트 목록 API
2. `/api/admin/clients/approve` - 승인 처리 API
3. `/api/admin/clients/suspend` - 일시 중지 API
4. `/admin/clients` - 관리자 UI 페이지
5. 텔레그램 알림 (신규 OAuth 인증 시)

### Phase 3: 클라이언트 로그인 UI (0.5일)
1. `/login` 페이지 생성 (Meta 로그인 버튼)
2. `/pending` 페이지 (승인 대기 안내)
3. 상태별 리다이렉션 처리

### Phase 4: 토큰 관리 (0.5일)
1. 토큰 갱신 로직
2. 만료 임박 알림
3. active 상태만 갱신 대상

### Phase 5: 테스트 및 검수 준비 (1일)
1. 전체 플로우 테스트
2. 스크린캐스트 녹화 (OAuth → 승인 → 대시보드)
3. Meta 앱 설정 완료

---

## 11. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 검수 거절 | 서비스 지연 | 거절 사유 분석 후 재제출 |
| 토큰 만료 | 데이터 수집 중단 | 자동 갱신 + 알림 |
| Rate Limit | API 호출 제한 | 사용자 증가로 자연 해결 |

---

## 12. 성공 지표

- [ ] OAuth 로그인 플로우 정상 작동
- [ ] 토큰 자동 저장 및 갱신
- [ ] Meta 앱 검수 통과
- [ ] 기존 기능 정상 유지

---

## 부록

### A. 참고 문서
- [Meta OAuth 가이드](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)
- [Marketing API 권한](https://developers.facebook.com/docs/marketing-api/overview/authorization)
- [앱 검수 가이드](https://developers.facebook.com/docs/app-review)

### B. 관련 프로젝트
- `F:\bas_meta` - 동일한 OAuth 시스템 적용 예정
- `F:\polarad-meta` - 우선 구현 대상
