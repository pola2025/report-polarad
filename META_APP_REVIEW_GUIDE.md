# POLA-REPORT — Meta App Review 재제출 가이드

App ID: **2081730902593417**
대상: 5개 권한 재제출 (+ Marketing API Access Tier 별도 트랙)
작성일: 2026-05-16
URL: https://report.polarad.co.kr

---

## 1. 거절 사유 요약 (이전 제출)

| 권한 | Meta 거절 사유 | 진짜 원인 |
|---|---|---|
| Marketing API Access Tier | 지난 15일간 충분한 Ads API 호출 없음 | API 호출량 부족. **이용사례와 무관 → 별도 트랙** |
| ads_management | 사용 사례와 일치하지 않는 스크린캐스트 | 목업 스샷 제출, end-to-end 흐름 부재 |
| ads_read | 동일 | 동일 |
| business_management | 동일 | 동일 |
| pages_show_list | 동일 | 동일 |
| pages_read_engagement | 동일 | 동일 |

**핵심 한 줄**: 5개 권한은 텍스트 문제가 아니라 **"실제 운영 화면 + 권한 부여 흐름 + end-to-end 데모"가 들어간 스크린캐스트를 다시 찍어야** 통과합니다.

---

## 2. 재제출 전 사전 준비 (코드 수정 필요)

### 2-1. OAuth 스코프 확장

`dashboard/src/lib/meta-oauth.ts:19`

```ts
// 현재
const OAUTH_SCOPE = 'ads_read'

// 수정
const OAUTH_SCOPE = [
  'ads_read',
  'ads_management',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'public_profile',
].join(',')
```

이걸 안 하면 영상에서 광고주가 동의 화면을 봐도 권한이 1개만 뜹니다 → Meta 검수자가 "이 앱은 ads_read만 요청하는데?"로 의심.

### 2-2. `/login` 페이지에 요청 권한 5개 표시

`dashboard/src/app/login/page.tsx:288~310` 의 "연결 시 요청되는 권한" 리스트를 5개로 확장:

- 광고 성과 데이터 읽기 (ads_read)
- 광고 캠페인 관리 (ads_management)
- 비즈니스 매니저 자산 조회 (business_management)
- Facebook 페이지 목록 조회 (pages_show_list)
- 페이지 인사이트 읽기 (pages_read_engagement)

### 2-3. 영어 UI 옵션 (강력 권장)

Meta 검수자는 한국어를 못 읽습니다. 다음 중 하나:

- **권장**: 헤더에 EN/KR 토글 추가, 영상은 EN 모드로 녹화
- **차선**: `/meta` 데모 페이지는 이미 영어. 영상에서 `/meta` 진입 후 흐름 위주로 녹화

### 2-4. Privacy Policy / Terms 페이지 영문 확인

`/privacy`, `/terms` 가 한글뿐이면 영문 버전 추가. 검수자가 데이터 처리 방침을 못 읽으면 거절 사유가 됨.

### 2-5. 데이터 삭제 콜백 URL

App Settings → "User Data Deletion Callback URL" 확인. 비어있으면 `/api/auth/delete-callback` 같은 엔드포인트 만들고 등록.

---

## 3. 권한별 사용처 매핑 (실제 코드 기반)

| 권한 | Meta API 호출 함수 | UI 표시 위치 | 영상에 보여줄 화면 |
|---|---|---|---|
| ads_read | `getAdAccounts`, `getAdCampaigns`, `getCampaignInsights` (`meta-oauth.ts:149,387,447`) | `/meta/ads-read` 카드 + 메인 대시보드 KPI(노출/클릭/지출/CTR) + 리포트 | `/meta/ads-read` → 대시보드 채널별 성과 테이블 |
| ads_management | `updateCampaignStatus` (`meta-oauth.ts:417`) | `/meta/ads-management` 페이지의 Pause/Activate 버튼 | `/meta/ads-management` → 실제 캠페인 status 토글 동작 |
| business_management | `getBusinesses`, `getBusinessDetails` (`meta-oauth.ts:248,272`) | `/meta/business-management` Ad Account 목록 | `/meta/business-management` 카드 |
| pages_show_list | `getPages` (`meta-oauth.ts:223`) | `/meta/pages-show-list` Page 목록 + 클라이언트 설정에서 Page 선택 | `/meta/pages-show-list` 카드 |
| pages_read_engagement | `getPageInsights`, `getPageDetails` (`meta-oauth.ts:300,360`) | `/meta/pages-read-engagement` 팔로워/도달/참여수 | `/meta/pages-read-engagement` 카드 |

`/meta` 인덱스 페이지가 이미 5개 카드 + "How POLA-REPORT uses this data" 영문 설명까지 잘 만들어져 있어 영상의 메인 무대로 활용하면 됩니다.

---

## 4. 통합 스크린캐스트 시나리오 (한 편 5분, 5개 권한 모두 커버)

### Pre-flight 체크
- [ ] OAuth scope 5개로 수정 + 배포 완료
- [ ] `/login` 권한 리스트 5개로 업데이트
- [ ] 화면 영어 UI (또는 메인 흐름은 `/meta/*` 위주)
- [ ] OBS / Loom 등으로 1080p 60fps 녹화
- [ ] **마우스 커서 강조 표시 ON** (Meta 가이드 권장)
- [ ] 자막은 영어로 추가 (각 장면 캡션)

### Scene 1 — Intro (0:00~0:20, 자막만)
화면: 검은 배경 + 영문 텍스트
```
POLA-REPORT — Marketing analytics platform for Polarad ad agency
Used by approved agency staff to view client ad performance
Server-to-server architecture with System User token
```

### Scene 2 — 광고주가 권한 부여 (0:20~1:30) ★ 가장 중요
이전 거절의 핵심 사유. 두 가지 옵션:

**Option A (권장) — Real OAuth Flow**:
1. 새 시크릿 창에서 https://report.polarad.co.kr/login 접속
2. "Continue with Meta" 버튼 클릭
3. Facebook 동의 화면 표시 (5개 권한 모두 노출 확인)
4. 광고주가 본인 광고계정/Page 선택
5. "Continue" 클릭 → callback → `/meta` 인덱스 진입

**Option B — Business Manager 권한 부여 (시스템 사용자 토큰 케이스)**:
1. business.facebook.com → Business Settings → Apps
2. "Add" → POLA-REPORT 검색 → 추가
3. Ad accounts → 광고계정 선택 → Assign people and assets → POLA-REPORT 앱 추가, "Manage campaigns" 권한 부여
4. Pages → 동일하게 POLA-REPORT 추가
5. 추가 캡션: *"After the client grants Business asset permissions, our system user token can read this data"*

### Scene 3 — `/meta` 인덱스 (1:30~2:00)
- "Connected Meta Services" 헤더
- 5개 권한 카드 + 모두 ✅ 표시
- 캡션: *"All five permissions are active and the data flows successfully"*

### Scene 4 — pages_show_list (2:00~2:20)
- "Facebook Pages" 카드 클릭 → `/meta/pages-show-list` 진입
- 광고주 Page 목록 표시
- 캡션: *"pages_show_list — listing Pages the user manages, used to map clients to Pages"*

### Scene 5 — pages_read_engagement (2:20~2:40)
- "Page Insights" 카드 → `/meta/pages-read-engagement`
- Followers, Page Likes, Impressions, Engaged Users 4개 KPI
- 캡션: *"pages_read_engagement — engagement metrics shown alongside ad performance"*

### Scene 6 — business_management (2:40~3:00)
- "Business Accounts" 카드 → `/meta/business-management`
- Ad Account 목록 (이름/ID/Status)
- 캡션: *"business_management — listing ad accounts under client's Business Manager"*

### Scene 7 — ads_read (3:00~3:30)
- "Ad Accounts" 카드 → `/meta/ads-read`
- Account #1 카드 (이름/ID/Status/Currency/Amount Spent)
- 캡션: *"ads_read — reading ad account performance for reporting"*
- (보너스) 메인 대시보드(`/?client=hea-pangyo`)로 이동해서 노출/클릭/지출 KPI 카드 보여주기 — 캡션: *"This data powers the daily client dashboard"*

### Scene 8 — ads_management (3:30~4:30) ★ 두 번째로 중요
- "Ad Control" 카드 → `/meta/ads-management`
- 캠페인 목록 표시
- ACTIVE 캠페인의 **"Pause" 버튼 클릭** → status 변경 확인
- PAUSED → "Activate" 클릭 → 다시 ACTIVE
- 캡션: *"ads_management — actually toggling campaign status via POST /v22.0/{campaign_id}"*
- ★ Meta는 "버튼만 있고 동작 안 함" 거절을 자주 함. 실제 status가 바뀌는 걸 보여줘야 함.

### Scene 9 — Outro (4:30~5:00)
- 메인 대시보드(`/`)로 돌아가서 데이터가 표시되는 모습
- 자막:
```
All Meta data is fetched server-to-server via System User token
Data is used only for ad performance reporting to authorized agency staff
Privacy Policy: https://report.polarad.co.kr/privacy
```

### 녹화 모범 사례 체크리스트
- [ ] 마우스 커서 강조
- [ ] 각 장면 영문 자막 또는 캡션
- [ ] 1080p 60fps
- [ ] 5분 이내 (Meta 권장 3~5분)
- [ ] mp4 H.264, 100MB 이내

---

## 5. 권한별 Use Case 텍스트 (영문, 그대로 붙여넣기 가능)

### 5-1. ads_read

**How will your app use this permission?**
```
POLA-REPORT is an internal marketing analytics platform used by Polarad,
a Meta-certified ad agency, to monitor and report on the ad campaign
performance of our clients (advertisers who have signed contracts with
our agency).

After a client grants our agency access to their Business Manager and
ad accounts (via Business Settings → Add People), POLA-REPORT uses
ads_read with a System User access token to:

1. Retrieve the list of ad accounts owned by the client
   (GET /me/adaccounts)
2. Pull campaign-level metrics — impressions, clicks, spend, reach,
   CTR, CPC, video views, leads — via
   GET /act_{ad_account_id}/insights
3. Display these metrics in our dashboard (https://report.polarad.co.kr)
   and in monthly/weekly performance reports we deliver to clients.

This permission is read-only and is used purely for reporting; we do
not modify any campaign with ads_read alone.

The screencast walks through the full flow: client grants permission
→ token is stored → POLA-REPORT calls /me/adaccounts → ad account
data is rendered on the /meta/ads-read demo page and on the live
client dashboard.
```

### 5-2. ads_management

**How will your app use this permission?**
```
POLA-REPORT uses ads_management to give our agency operators a
quick "pause underperforming campaigns" control directly inside the
analytics dashboard, without having to switch to Ads Manager.

Specifically:
1. While reviewing a client's campaign performance on
   /meta/ads-management, the operator sees each active campaign
   alongside a Pause / Activate button.
2. Clicking Pause issues POST /v22.0/{campaign_id} with
   {"status": "PAUSED"}.
3. Clicking Activate issues the same call with {"status": "ACTIVE"}.
4. The UI reflects the new status immediately after the API call
   succeeds.

The screencast demonstrates this end-to-end: an ACTIVE campaign is
paused (status badge changes to PAUSED), then re-activated. The
dashboard never creates new campaigns, never changes budgets, never
modifies creatives — only flips ACTIVE/PAUSED for fast response to
performance changes.
```

### 5-3. business_management

**How will your app use this permission?**
```
POLA-REPORT serves multiple clients, each with their own Business
Manager. business_management is needed so we can:

1. Enumerate the Business Manager(s) the agency has been granted
   access to (GET /me/businesses)
2. Read business asset details — owned ad accounts, owned Pages —
   so we can correctly map each client to their advertising assets
   (GET /{business-id}?fields=owned_ad_accounts,owned_pages)
3. Keep our internal client→ad account mapping accurate even when
   the client adds or removes ad accounts on their side.

The /meta/business-management demo page in the screencast shows the
list of ad accounts retrieved through this permission. We do not
write to any business asset; this is purely for asset discovery
and synchronisation.
```

### 5-4. pages_show_list

**How will your app use this permission?**
```
Many of our clients run Facebook Page-based ad campaigns and also
want their organic Page metrics included in the same report.

pages_show_list lets POLA-REPORT call GET /me/accounts to enumerate
the Pages the connecting user manages, then present them in the
dashboard so the agency operator can map the correct Page to the
correct client.

The screencast shows /meta/pages-show-list rendering the list of
Pages with id, name and category — this is exactly the data we use
to populate the "Page selection" UI inside the client setup flow.
```

### 5-5. pages_read_engagement

**How will your app use this permission?**
```
Once a Page is mapped to a client, POLA-REPORT uses
pages_read_engagement together with the Page Access Token to read
that Page's engagement metrics:

- followers_count, fan_count (GET /{page-id})
- page_impressions, page_engaged_users, page_post_engagements
  (GET /{page-id}/insights)

These metrics are displayed alongside paid ad performance so the
client gets a single consolidated view (organic Page reach + paid
ads). The /meta/pages-read-engagement demo page in the screencast
shows the four headline metrics (Followers, Page Likes, Impressions,
Engaged Users) as actually rendered to the operator.

We do not post to the Page, do not read messages, and do not access
any user-level engagement data — only Page-level aggregate insights.
```

---

## 6. 제출 노트 (Submission Notes — 모든 권한에 공통으로 붙임)

```
POLA-REPORT is a server-to-server internal reporting application
used exclusively by approved staff at Polarad, a Meta-certified ad
agency in South Korea (https://polarad.co.kr).

End customers (the advertisers who hire us) are NEVER asked to
authenticate with Facebook through this application.  Instead, the
client grants our agency access to their Business Manager and ad
accounts via Business Settings → Add People & Assets.  The
application then accesses Meta's Marketing API using a System User
access token tied to our own Business Manager.

This is why the screencast does not show a typical end-user OAuth
"Continue with Facebook" pop-up for each client.  The screencast
DOES show:

1. The agency operator logging into our internal dashboard
2. The /meta hub listing all five active permissions
3. End-to-end data flow for each requested permission
4. Live ads_management toggling (Pause / Activate) on a real campaign

Test credentials for the reviewer (live demo account):
- URL: https://report.polarad.co.kr/login
- Email: <reviewer email here>
- Password / OTP: provided in the appsubmission credentials field

Privacy Policy: https://report.polarad.co.kr/privacy
Terms of Service: https://report.polarad.co.kr/terms
Data Deletion Instructions: https://report.polarad.co.kr/data-deletion
```

---

## 7. Marketing API Access Tier — 별도 트랙

이건 use case가 아니라 **API 호출량** 문제입니다.

### 통과 조건 (2026 기준)
- 최근 15일간 Ads API 성공 호출 **1,500회 이상** (앱 토큰 기준)
- Standard Access는 더 높음 (10,000회 이상 권장)

### 액션 플랜
1. **현재 호출량 확인**: App Dashboard → App Insights → API Calls
2. **호출량 늘리기**: backfill cron (`/api/cron/backfill`)이 매일 도는데도 부족하다면 클라이언트 추가 또는 호출 빈도 증가
3. **15일 대기 후 재신청**: 충분한 데이터가 쌓인 뒤 별도 제출
4. 5개 권한이 먼저 통과되면 호출량이 자연스럽게 늘어남 → Marketing API Tier는 마지막에 신청 권장

---

## 8. 재제출 체크리스트 (최종)

### 코드
- [ ] `meta-oauth.ts` OAUTH_SCOPE 5개 확장
- [ ] `/login` 권한 리스트 5개로 업데이트
- [ ] `/privacy`, `/terms`, `/data-deletion` 영문 버전 확인
- [ ] User Data Deletion Callback URL 등록
- [ ] 배포 완료 후 https://report.polarad.co.kr/meta 에서 5개 카드 모두 ✅ 확인

### 영상
- [ ] Pre-flight 체크 통과
- [ ] Scene 1~9 모두 녹화
- [ ] 광고주 권한 부여 흐름 포함 (Scene 2)
- [ ] ads_management 실제 status 토글 (Scene 8)
- [ ] 영문 자막 / 캡션
- [ ] mp4 5분 이내 / 100MB 이내

### 제출
- [ ] 5개 권한 각각에 위 영문 use case 붙여넣기
- [ ] Submission Notes에 server-to-server 명시
- [ ] 스크린캐스트 업로드
- [ ] 테스트 계정 + 비밀번호 입력
- [ ] Privacy Policy / Terms URL 입력 확인
- [ ] Submit

---

## 9. 참고 링크
- [Screen Recording Guidelines](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings)
- [Permissions Reference](https://developers.facebook.com/docs/permissions)
- [Marketing API Access Tier](https://developers.facebook.com/docs/marketing-api/access)
- [Common Rejection Reasons](https://developers.facebook.com/docs/app-review/support/rejection-guides/)
