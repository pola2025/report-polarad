# Meta 앱 검수 가이드 (2024-2026)

> 최종 업데이트: 2026-01-26

---

## 핵심 요약

| 항목 | 내용 |
|------|------|
| **테스트 유저** | 2023년 9월부터 **폐지됨** |
| **스크린캐스트** | **필수** - 각 권한별로 별도 영상 필요 |
| **리뷰어 검증** | 스크린캐스트 보고 **직접 재현** 시도함 |
| **검수 소요시간** | 평균 **5일**, 길면 1-2주 |
| **Advanced Access** | 프로덕션 필수, Standard는 데모 수준 |

---

## 결론: 스크린캐스트만으로 통과 가능한가?

### 아니오, 직접 테스트함

Meta 리뷰어는 **스크린캐스트를 보고 직접 재현**을 시도합니다.

> "We were unable to fully replicate the experience from step #3"
> — 실제 리젝 사유

### 필요한 것

1. **스크린캐스트 영상** - 각 권한별 사용 방법
2. **테스트 가능한 계정** - 리뷰어가 로그인해서 테스트
3. **실제 동작하는 앱** - 데모가 아닌 실제 기능

---

## 테스트 계정 문제 해결 방법

### 방법 1: 더미 Facebook 계정 생성 (권장)

```
1. 더미 Facebook 계정 생성
2. 앱에 Developer/Tester 역할 추가
3. 2FA 설정 + 리뷰어에게 2FA 코드 제공 방법 마련
4. 테스트 지침에 이메일/비밀번호 + 2FA 접근법 명시
```

### 방법 2: Test App 사용

- 실제 앱과 연결된 Test App 생성
- Test App은 Live 모드 불가 (테스트 전용)
- 모든 권한 테스트 가능

---

## 스크린캐스트 요구사항

### 필수 조건

| 항목 | 요구사항 |
|------|----------|
| 형식 | 고유한 영상 (다른 앱에서 사용한 영상 거절) |
| 내용 | 권한이 **어떻게** 사용자에게 도움이 되는지 |
| 길이 | 등록부터 결과까지 **1분 이내** 권장 |
| 언어 | 영어 권장 |

### 자주 리젝되는 이유

1. **Use Case 불명확**
   > "Your screencast doesn't show how the use of this permission directly improves the user experience"

2. **로그인/테스트 실패**
   > "We were unable to fully replicate the experience"

3. **권한 불일치**
   > "Your app does not require Page Public Content Access for its intended function"

---

## 권한별 검수 팁

### pages_show_list

- 사용자가 관리하는 페이지 목록 표시
- 페이지 선택 → 분석 대시보드 연결 시연

### pages_read_engagement

- 페이지 인사이트 데이터 사용 목적 명시
- 실제 차트/리포트에 데이터가 표시되는 화면 필요

### business_management

- 비즈니스 매니저 연동 이유 명시
- 광고 계정 목록 조회 → 리포트 생성 흐름 시연

### ads_read

- 광고 성과 데이터 조회 목적
- 실제 대시보드에서 데이터 표시 화면 필수

### ads_management

- 광고 생성/수정 기능이 **실제로** 필요한지 확인
- 단순 조회만 필요하면 ads_read로 충분

---

## Advanced Access vs Standard Access

| 항목 | Standard Access | Advanced Access |
|------|-----------------|-----------------|
| 용도 | 개발/테스트 | 프로덕션 |
| 접근 가능 데이터 | 본인 계정만 | 모든 연결된 계정 |
| Rate Limit | 심각하게 제한됨 | 정상 |
| 요구사항 | 없음 | App Review + Business Verification |

### 주의: Standard Access는 "데모 모드"

> "Standard Access is basically useless for any real application"
> — 개발자 후기

---

## 검수 타임라인

```
┌─────────────────────────────────────────┐
│ 1. 앱 제출                    Day 0     │
├─────────────────────────────────────────┤
│ 2. 초기 검토                  Day 1-3   │
├─────────────────────────────────────────┤
│ 3. 승인/거절 결정             Day 3-5   │
├─────────────────────────────────────────┤
│ 4. 거절 시 수정 후 재제출     +3-5일    │
├─────────────────────────────────────────┤
│ 5. Business Verification      별도 진행 │
│    (일부 권한 필수)           수일~수주 │
└─────────────────────────────────────────┘
```

---

## 실제 성공/실패 후기

### 성공 사례

> "He supported us in getting the required permissions in only **36 hours**"
> — Matthias, Germany, 2024

> "After a month of trying to get Instagram permissions, he fixed the issue in **one go**"
> — Samer, Lebanon, 2024

### 실패 사례 및 교훈

> "Days turned into over a week of not being able to properly test the integration"
> — Advanced Access 대기 중 프로젝트 지연

> "You get very little feedback when your app is rejected - usually just 'we couldn't see how the permission is being used'"
> — 피드백 부족 문제

---

## 검수 통과 체크리스트

### 제출 전

- [ ] 1024x1024 고해상도 앱 로고
- [ ] 각 권한별 스크린캐스트 영상 준비
- [ ] Privacy Policy URL (접근 가능)
- [ ] Terms of Service URL
- [ ] 테스트 계정 정보 (또는 더미 계정 준비)
- [ ] Business Verification 완료 (필요 권한의 경우)

### 스크린캐스트

- [ ] 각 권한별 별도 영상
- [ ] 1분 이내 권장
- [ ] 사용자 혜택 명확히 표시
- [ ] 데이터가 실제로 화면에 표시되는 장면 포함
- [ ] 다른 앱에서 사용한 영상 아님

### 앱 기능

- [ ] 실제 동작하는 기능 (데모 아님)
- [ ] 요청 권한이 실제로 필요한 기능
- [ ] 에러 처리 완료
- [ ] 리뷰어가 테스트할 수 있는 상태

---

## POLA-REPORT 앱 검수 전략

### 현재 상태

- 앱 ID: `2081730902593417`
- 검수용 페이지: `https://report.polarad.co.kr/meta`

### 권한별 전략 (4개 - 모두 읽기 전용)

| 권한 | 시연 내용 |
|------|----------|
| pages_show_list | 페이지 목록 → 선택 → 대시보드 연결 |
| pages_read_engagement | 페이지 인사이트 → 리포트 차트 표시 |
| business_management | 비즈니스 → 광고 계정 → 리포트 생성 |
| ads_read | 광고 성과 데이터 → KPI 대시보드 |

> **참고**: ads_management (광고 생성/수정) 권한은 제외함 (2026-01-26)

### 리젝 방지를 위해 추가한 것

1. **User Experience Benefit** 섹션 - 각 권한의 사용자 혜택 명시
2. **Data Flow 시각화** - Meta API → POLA-REPORT → User Dashboard
3. **"Demo" 표현 제거** - Marketing Analytics Platform으로 변경
4. **API 호출 정보** - 각 페이지에 endpoint와 fields 표시

---

## 참고 링크

- [Facebook App Review Without Test Users (2023)](https://medium.com/@chriscouture/how-to-get-your-meta-facebook-app-approved-in-2023-tips-code-snippets-for-navigating-reviews-c1305da5f929)
- [Navigating the Facebook App Review Process](https://dancerscode.com/posts/navigating-the-facebook-app-review-process/)
- [Facebook App Review Guide - Convertr](https://support.convertrmedia.com/hc/en-us/articles/360010746573-Completing-the-Facebook-App-Review)
- [Facebook Marketing API Advanced Access](https://medium.com/@bilal.105.ahmed/facebook-marketing-api-the-advanced-access-trap-that-nearly-killed-my-project-7227ea2ee2c2)
- [3CX Facebook Review Fails Discussion](https://www.3cx.com/community/threads/facebook-app-review-fails.122095/)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-26 | 초기 작성 |
