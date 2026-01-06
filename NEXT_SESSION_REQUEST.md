# 다음 세션 요청문

## 복사해서 사용:
```
Vercel 배포 확인하고 광고별 성과 분석에서 영상조회, 평균시청 데이터가 표시되는지 확인해줘.
NEXT_SESSION_REQUEST.md 파일에 상세 컨텍스트 있음.
```

---

## 이전 세션 완료 작업 (2025-01-06)

### 1. Meta 광고 레벨 데이터 백필 구현
- Meta API `level=ad`로 변경하여 광고별 데이터 수집
- Airtable에 `ad_id` 필드 추가 (중복 체크용)
- 중복 체크 로직 변경: date + source + device → date + source + ad_id
- 광고명 표시 형식: `광고명 (캠페인명)`

### 2. 영상 데이터 추가
- Airtable에 `video_views`, `video_thruplay` 필드 추가
- Meta API에서 `video_play_actions`, `video_thruplay_watched_actions` 수집
- API 응답에 video_views 포함
- 백필 스크립트 업데이트

### 3. 데이터 백필 완료
- H.E.A 판교: 87개 레코드 생성
- 나라똔: 103개 레코드 생성
- 영상 데이터 포함 확인 (video_views, video_thruplay 값 있음)

### 4. Git 커밋 및 푸시
- 커밋 1: `feat: Meta 광고 레벨 데이터 백필 및 광고별 성과 분석 개선`
- 커밋 2: `feat: Meta 광고에 영상 데이터 추가 (video_views, video_thruplay)`
- Vercel 자동 배포 트리거됨

---

## 이번 세션 작업

- [ ] Vercel 배포 완료 확인 (1-2분 소요)
- [ ] 대시보드에서 영상조회/평균시청 데이터 표시 확인
  - URL: https://report.polarad.co.kr/?client=hea-pangyo
  - "Meta 상세" 탭 → "광고별 성과 분석" 테이블
- [ ] 영상조회 데이터가 0이면 UI 컴포넌트 수정 필요할 수 있음

---

## 중요 컨텍스트

### Airtable 데이터 구조
```
date: 날짜
device: 디바이스 (mobile_app, desktop 등)
impressions, clicks, spend: 기본 지표
ad_id: Meta 광고 고유 ID (중복 체크용)
campaign_name: "광고명 (캠페인명)" 형식
video_views: 영상 재생 수
video_thruplay: 영상 완전 시청 수
```

### H.E.A 판교 영상 데이터 샘플
```
video_views: 1~7 (디바이스별로 분산)
video_thruplay: 0~2
```

### 관련 파일
- `src/app/api/cron/backfill/route.ts` - Cron 백필 로직
- `src/app/api/meta/analytics/route.ts` - Meta 분석 API
- `src/lib/airtable.ts` - Airtable 타입 및 조회
- `src/components/meta/MetaAdTable.tsx` - 광고별 성과 분석 테이블
- `scripts/backfill-meta-ads.js` - 수동 백필 스크립트

---

## 프로젝트 정보

- **경로**: F:\polarad-meta
- **GitHub**: github-pola2025:pola2025/report-polarad
- **Vercel**: https://report.polarad.co.kr
- **Supabase**: mpljqcuqrrfwzamfyxnz (Polarad 전용)

### 클라이언트 정보
| 클라이언트 | slug | 특징 |
|-----------|------|------|
| H.E.A 판교 | hea-pangyo | Meta(지출액+노출수+영상조회) + Naver |
| 나라똔 | naratton | Meta(지출액+노출수+리드수) + Naver |
