# POLA-REPORT — Meta App Review 종합 체크리스트

App ID: **2081730902593417** / 도메인: **report.polarad.co.kr**
방식: TDD — 미충족 항목(❌)을 ✅로 하나씩 통과시켜 재제출
작성: 2026-05-16

## 상태 범례

- ✅ 통과 (검증 완료)
- 🟡 부분 충족 / 검증 필요
- ❌ 미충족 (작업 필요)
- ⚪ 해당 없음 / 추후 트랙

---

## 0. Meta 피드백 → 요건 → 구현 → 제출 증명 매핑

> 본 섹션이 TDD의 **테스트 명세**. 이 테이블의 모든 행이 "구현 ✅ + 증명 ✅" 가 되면 거절 사유가 해소된다.
> 아래 A~H 섹션은 이 매핑을 달성하기 위한 하위 실행 작업.

### 0-1. 거절 사유 #1 — "사용 사례 상세 정보와 일치하지 않는 스크린캐스트"

적용 권한: `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement` (5건 모두 동일 사유)

Meta 본문(한글 번역):

> 앱의 사용 사례는 허용되지만, 제출된 스크린캐스트가 사용 사례의 엔드투엔드 경험을 보여주지 못해 거부됩니다. 재제출 시 다음을 포함한 새 스크린캐스트가 필요합니다.

| #   | Meta 요구 요건                      | 기술 구현 (어디서 충족)                                                                                                      | 제출 시 증명 방법 (검수자가 어디서 확인)                                                                                   | 상태                                    |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| R1  | 전체 로그인 플로                    | `/login` → `/api/auth/login` → Facebook OAuth dialog → `/api/auth/callback` → `/meta` 진입. OAuth scope에 5개 권한 모두 포함 | **영상 Scene 2** 처음부터 끝까지 1컷 녹화 (`/login` 진입 → "Continue with Meta" → fb.com 동의화면 → callback → /meta 도착) | 🟡 (C1·C2 완료, C7 배포 + C8 검증 남음) |
| R2  | 사용자가 권한 부여하는 장면         | OAuth dialog에서 5개 권한이 명시적으로 노출되어 사용자가 "Continue" 클릭 (서버간 케이스면 Business Manager → Add App 흐름)   | **영상 Scene 2** 동의 화면(스코프 5개 표시) + Continue 클릭 화면                                                           | ❌                                      |
| R3  | 권한별 end-to-end 사용 사례         | `/meta/{permission}` 5개 데모 페이지 + 메인 대시보드에서 ads_read 활용 + ads-management 토글 실제 동작                       | **영상 Scene 4~8** 권한별 1장면씩, ads_management는 실제 Pause/Activate 시연                                               | 🟡 (코드 완비, 영상 미제작)             |
| R4  | 영어 UI + 자막 + 도구팁             | `/meta/*` 영문, `/login` 영문 병기, `/privacy /terms /data-deletion` 영문 본문                                               | **영상 자막(SRT)** 영문 + 캡션이 모든 장면에서 보임                                                                        | 🟡 (C1~C5 작업 중, SRT 미작성)          |
| R5  | server-to-server / System User 명시 | Privacy Policy(§2~4), Submission Notes 본문                                                                                  | **Submission Notes** + Scene 1 자막에 명시 + Privacy Policy URL이 검수자가 열어볼 수 있음                                  | ❌                                      |

검수자 관점 패키지:

- 영상 1편 (R1~R5 모두 충족 증명)
- 권한별 Use Case 영문 5개 (R3 보조 증명)
- Submission Notes (R5 핵심)
- Privacy Policy / Terms / Data Deletion URL (R4·R5 보조)
- Test 계정 (검수자 직접 재현용)

### 0-2. 거절 사유 #2 — "지난 15일간 충분한 Ads API 호출 부재"

적용: `Marketing API Access Tier` 1건

| #   | Meta 요구 요건                   | 기술 구현                                 | 제출 증명                                                   | 상태                            |
| --- | -------------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| R6  | 15일 누적 Ads API 호출 ≥ 1,500회 | 운영 호출량 자연 증가 또는 백필 빈도 상향 | App Dashboard → App Insights → API Calls 그래프 (재신청 시) | ⚪ (5개 권한 통과 후 별도 트랙) |

### 충족 진행 점수 (자동 업데이트 대상)

- R1: 🟡 → ✅ 조건: `C7 배포` + `C8 OAuth 동의화면 5개 권한 확인`
- R2: ❌ → ✅ 조건: `F2 Scene 2 녹화 완료`
- R3: 🟡 → ✅ 조건: `F4~F8 Scene 녹화 완료` + `A2-1 실제 토글 시연 영상`
- R4: 🟡 → ✅ 조건: `C5 /data-deletion 작성` + `F10 SRT 임베드`
- R5: ❌ → ✅ 조건: `C3·C4·C5 배포 + Submission Notes 본문 확정`

---

## A. 거부 피드백 직접 대응 (이전 제출 6건)

### A1. Marketing API Access Tier

- [ ] ⚪ **A1-1** Ads API 15일 호출 1,500회+ 달성 — 5개 권한 통과 후 별도 트랙
  - 검증: App Dashboard → App Insights → API Calls 그래프

### A2. ads_management

- [ ] ❌ **A2-1** end-to-end 스크린캐스트에서 실제 캠페인 status 토글 시연
  - 검증: 영상에 ACTIVE → PAUSED 버튼 클릭 → API 응답 → UI 반영 모두 보임
  - 시연 경로: `/meta/ads-management` (코드: `ads-management/page.tsx:29-57` 실제 동작)

### A3. ads_read

- [ ] ❌ **A3-1** 스크린캐스트에 실제 운영 데이터 표시 (목업 아님)
  - 검증: 광고계정명/지출액이 실제 광고주 데이터로 보임
  - 시연 경로: `/meta/ads-read` + `/?client=hea-pangyo` 메인 대시보드

### A4. business_management

- [ ] ❌ **A4-1** 비즈니스 자산 목록 조회 흐름이 영상에 포함
  - 검증: `/meta/business-management` Ad Account 카드 표시

### A5. pages_show_list

- [ ] ❌ **A5-1** Page 목록 조회 흐름이 영상에 포함
  - 검증: `/meta/pages-show-list` Page 카드 표시

### A6. pages_read_engagement

- [ ] ❌ **A6-1** Page 인사이트(팔로워/도달/참여) 흐름이 영상에 포함
  - 검증: `/meta/pages-read-engagement` 4개 KPI 카드 표시

---

## B. Meta 스크린 레코딩 가이드 준수

(https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings)

- [ ] ❌ **B1** 전체 로그인 플로 포함 (광고주가 권한 부여하는 장면)
  - 옵션 A: `/login` → "Continue with Meta" → Facebook 동의 화면(5개 권한) → callback
  - 옵션 B: business.facebook.com → Business Settings → Apps → POLA-REPORT 추가 → 자산 권한 부여
- [ ] ❌ **B2** 각 권한별 end-to-end 사용 사례 시연
- [ ] ❌ **B3** 영어 UI 또는 영어 캡션
- [ ] ❌ **B4** 버튼/UI 요소 의미 설명 (자막 또는 도구팁)
- [ ] ❌ **B5** 마우스 커서 강조 (highlight cursor)
- [ ] ❌ **B6** Server-to-server 앱 명시 (제출 노트 또는 자막)
- [ ] ❌ **B7** 1080p 60fps, mp4 H.264, 5분 이내, 100MB 이내

---

## C. 사전 코드 수정 (재제출 전 배포 필요)

- [x] ✅ **C1** `meta-oauth.ts` OAUTH*SCOPE 5개 권한으로 확장 — *완료 (2026-05-16)\_
- [x] ✅ **C2** `/login` 권한 안내 5개 영문/한글 병기 — _완료 (2026-05-16)_
- [x] 🟡 **C3** `/privacy` 페이지 작성 — _작성됨 (2026-05-16), 배포·렌더링 검증 필요_
- [x] 🟡 **C4** `/terms` 페이지 작성 — _작성됨 (2026-05-16), 배포·렌더링 검증 필요_
- [x] 🟡 **C5** `/data-deletion` 페이지 작성 — _작성됨 (2026-05-16), 배포·렌더링 검증 필요_
- [x] 🟡 **C6** `/api/auth/delete-callback` API endpoint 작성 — _작성됨 (2026-05-16), signed_request HMAC-SHA256 검증 + 소프트 삭제 + 텔레그램 알림. 배포·E2E 테스트 필요_
- [ ] ❌ **C7** 메인 배포 (Vercel) — `report.polarad.co.kr/{privacy,terms,data-deletion}` HTTP 200 확인
- [ ] ❌ **C8** `/login`에서 "Continue with Meta" 클릭 시 5개 권한 동의 화면이 실제로 뜨는지 확인 (배포 후)

---

## D. Meta App Settings 등록 항목 (개발자 콘솔에서)

- [ ] 🟡 **D1** App Domains: `report.polarad.co.kr` 포함 확인
- [ ] 🟡 **D2** Valid OAuth Redirect URIs: `https://report.polarad.co.kr/api/auth/callback` 포함
- [ ] ❌ **D3** Privacy Policy URL: `https://report.polarad.co.kr/privacy`
- [ ] ❌ **D4** Terms of Service URL: `https://report.polarad.co.kr/terms`
- [ ] ❌ **D5** Data Deletion Instructions URL: `https://report.polarad.co.kr/data-deletion`
- [ ] ❌ **D6** User Data Deletion Callback URL: `https://report.polarad.co.kr/api/auth/delete-callback`
- [ ] 🟡 **D7** App Icon (1024x1024 PNG) 등록
- [ ] 🟡 **D8** Category 설정 (Business and Pages 권장)
- [ ] 🟡 **D9** Business Verification 완료 상태 확인 (business_management/ads_management 필수)
- [ ] 🟡 **D10** Data Use Checkup 12개월 이내 완료

---

## E. 제출 폼 본문 (각 권한별)

- [ ] ❌ **E1** ads_read use case 영문 — META_APP_REVIEW_GUIDE.md §5-1 그대로 사용
- [ ] ❌ **E2** ads_management use case 영문 — §5-2
- [ ] ❌ **E3** business_management use case 영문 — §5-3
- [ ] ❌ **E4** pages_show_list use case 영문 — §5-4
- [ ] ❌ **E5** pages_read_engagement use case 영문 — §5-5
- [ ] ❌ **E6** Submission Notes (5개 권한 공통, server-to-server 명시) — §6
- [ ] ❌ **E7** Reviewer test account credentials 입력
- [ ] ❌ **E8** 스크린캐스트 mp4 업로드

---

## F. 영상 시나리오 9 Scene 충족

(META_APP_REVIEW_GUIDE.md §4 기준)

- [ ] ❌ **F1** Scene 1 — Intro 자막 (server-to-server 선언)
- [ ] ❌ **F2** Scene 2 — 광고주 권한 부여 (B1과 연결)
- [ ] ❌ **F3** Scene 3 — `/meta` 인덱스 5개 카드 ✅ 표시
- [ ] ❌ **F4** Scene 4 — pages_show_list 시연
- [ ] ❌ **F5** Scene 5 — pages_read_engagement 시연
- [ ] ❌ **F6** Scene 6 — business_management 시연
- [ ] ❌ **F7** Scene 7 — ads_read 시연 (+ 운영 대시보드)
- [ ] ❌ **F8** Scene 8 — ads_management 실제 토글 (A2-1과 연결)
- [ ] ❌ **F9** Scene 9 — Outro + Privacy Policy URL 자막
- [x] 🟡 **F10** SRT 자막 파일 작성 — `pola-report-app-review.srt` 작성 완료 (2026-05-16). 영상 녹화 시 임베드 또는 별도 트랙으로 첨부

---

## G. 운영 영향 격리 (사용자 명시 요구사항)

- [x] ✅ **G1** 메인 대시보드 컴포넌트 변경 0건
- [x] ✅ **G2** `/meta/*` 데모 페이지가 운영 데이터와 분리되어 있음 (자체 레이아웃)
- [x] ✅ **G3** `/privacy`, `/terms`, `/data-deletion` 자체 헤더 — 운영 레이아웃 무관
- [ ] ❌ **G4** `/api/auth/delete-callback` 운영 데이터 삭제 권한 없음 확인 (검증 토큰만 처리)
- [ ] 🟡 **G5** OAuth 스코프 변경이 기존 토큰에 미치는 영향 검증 (기존 토큰은 유효 유지)

---

## H. 일반 거부 가이드 사전 점검

(https://developers.facebook.com/docs/app-review/support/rejection-guides/)

- [ ] 🟡 **H1** 앱 이름·아이콘이 Meta 브랜드 표기 규정 준수
- [x] ✅ **H2** 비즈니스 계정과 앱 연결 완료 (business_id=1382618189928644 확인)
- [ ] ❌ **H3** Data Use Checkup 통과 상태
- [ ] 🟡 **H4** Test User 1명 이상 등록 (검수자 대신 로그인용)

---

## 진행 절차 (TDD 루프)

1. 본 체크리스트의 ❌ 항목 중 **선수 의존성 없는 것**부터 ✅로 통과
2. 각 항목 완료 시 본 파일에서 `[ ]` → `[x]`, ❌ → ✅로 표시 + 검증 결과 한 줄 추가
3. 모든 항목 ✅ 도달 시 재제출
4. 거절 시: 거부 사유를 본 체크리스트에 새 항목으로 추가 → 다시 루프

## 의존성 그래프 (최단 경로)

```
C1, C2 (코드)
   ↓
C3, C4, C5, C6 (페이지/API)
   ↓
C7 (배포)
   ↓
D1~D6, G4 (App Settings + 검증)
   ↓
C8 (OAuth 5권한 동의 화면 확인)
   ↓
F10 (SRT) ─→ F1~F9 (영상 녹화) ─→ A2~A6, B1~B7 (영상이 충족 증거)
   ↓
E1~E8 (제출 폼) → 제출 → Marketing Tier (A1) 별도 트랙
```
