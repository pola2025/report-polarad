# PRD: Polarad Meta 데이터 파이프라인 안정화

## 📋 개요

### 문제 정의
현재 데이터 백필, 정합성 검증, 리포트 생성 작업이 수동으로 반복되고 있으며, 다음과 같은 문제가 발생:

1. **백필 중복 데이터**: 스크립트 재실행 시 중복 레코드 생성
2. **데이터 누락**: 특정 기간 데이터가 저장되지 않음
3. **클라이언트 혼동**: HEA 판교/나라똔 테이블 구조 차이로 인한 에러
4. **정합성 검증 부재**: Meta API와 Airtable 데이터 불일치 감지 어려움
5. **환율 적용 오류**: USD/KRW 변환 로직 혼동

### 목표
- **자동화된 일일 데이터 파이프라인** 구축
- **데이터 정합성 자동 검증** 시스템
- **에러 알림 및 자동 복구** 메커니즘
- **중복 방지** 로직 강화

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                     데이터 파이프라인 아키텍처                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [GitHub Actions]                                                    │
│       │                                                              │
│       ▼                                                              │
│  ┌────────────────────┐                                             │
│  │   1. Fetch Stage   │  Meta API → 원시 데이터 수집                │
│  │   (fetch-meta.js)  │  - 클라이언트별 병렬 처리                   │
│  │                    │  - 재시도 로직 (3회)                        │
│  └─────────┬──────────┘                                             │
│            │                                                         │
│            ▼                                                         │
│  ┌────────────────────┐                                             │
│  │  2. Transform Stage│  데이터 변환 및 정제                         │
│  │  (transform.js)    │  - USD → KRW 환율 적용                      │
│  │                    │  - 디바이스 breakdown 처리                  │
│  └─────────┬──────────┘                                             │
│            │                                                         │
│            ▼                                                         │
│  ┌────────────────────┐                                             │
│  │   3. Upsert Stage  │  Airtable 저장                              │
│  │  (upsert.js)       │  - date + source + device 기준 upsert       │
│  │                    │  - Rate limit 처리 (200ms delay)            │
│  └─────────┬──────────┘                                             │
│            │                                                         │
│            ▼                                                         │
│  ┌────────────────────┐                                             │
│  │  4. Verify Stage   │  데이터 정합성 검증                          │
│  │  (verify.js)       │  - Meta API vs Airtable 비교                │
│  │                    │  - 불일치 시 알림                           │
│  └─────────┬──────────┘                                             │
│            │                                                         │
│            ▼                                                         │
│  ┌────────────────────┐                                             │
│  │  5. Alert Stage    │  Telegram 알림                              │
│  │  (notify.js)       │  - 성공/실패 결과                           │
│  │                    │  - 일일 요약 리포트                         │
│  └────────────────────┘                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 모듈 설계

### 1. 클라이언트 설정 모듈 (`lib/clients.js`)

```javascript
// 클라이언트별 설정을 중앙 관리
const CLIENTS = {
  'hea-pangyo': {
    name: 'H.E.A 판교',
    airtable: {
      baseId: 'appJlOqnadLsMJQYw',
      tableId: 'tbl8ftclEFG5ypohX',
      fields: ['date', 'device', 'impressions', 'clicks', 'spend', 'source']
    },
    meta: {
      currency: 'USD',  // API 반환 통화
      adAccountId: null  // Supabase에서 조회
    }
  },
  'naratton': {
    name: '나라똔',
    airtable: {
      baseId: 'appN2KzUoORRrb8X9',
      tableId: 'tblmC9Ft2ioXKXsrL',
      fields: ['date', 'device', 'impressions', 'clicks', 'spend', 'source']
    },
    meta: {
      currency: 'KRW',
      adAccountId: null
    }
  }
};
```

### 2. Upsert 모듈 (`lib/airtable-upsert.js`)

```javascript
// 중복 방지 Upsert 로직
async function upsert(clientSlug, records) {
  const client = CLIENTS[clientSlug];
  const { baseId, tableId } = client.airtable;

  for (const record of records) {
    // 고유 키: date + source + device
    const key = `${record.date}_${record.source}_${record.device}`;

    // 기존 레코드 조회
    const existing = await findByKey(baseId, tableId, record.date, record.source, record.device);

    if (existing) {
      // 이미 finalized면 스킵
      if (existing.fields.is_finalized) continue;

      // 업데이트
      await updateRecord(baseId, tableId, existing.id, record);
    } else {
      // 생성
      await createRecord(baseId, tableId, record);
    }

    await sleep(200); // Rate limit
  }
}
```

### 3. 정합성 검증 모듈 (`lib/verify.js`)

```javascript
// Meta API vs Airtable 비교
async function verifyIntegrity(clientSlug, startDate, endDate) {
  const metaData = await fetchMetaData(clientSlug, startDate, endDate);
  const airtableData = await fetchAirtableData(clientSlug, startDate, endDate);

  const issues = [];

  for (const date of getDateRange(startDate, endDate)) {
    const meta = aggregateByDate(metaData, date);
    const at = aggregateByDate(airtableData, date);

    // 허용 오차: 반올림 차이로 ±100원
    if (Math.abs(meta.spend - at.spend) > 100 ||
        meta.impressions !== at.impressions ||
        meta.clicks !== at.clicks) {
      issues.push({
        date,
        expected: meta,
        actual: at,
        diff: {
          spend: at.spend - meta.spend,
          impressions: at.impressions - meta.impressions,
          clicks: at.clicks - meta.clicks
        }
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
```

---

## 🔄 GitHub Actions 워크플로우

### daily-pipeline.yml

```yaml
name: Daily Data Pipeline

on:
  schedule:
    # 매일 오전 3시 (KST) = UTC 18:00 전날
    - cron: '0 18 * * *'
  workflow_dispatch:
    inputs:
      client:
        description: '클라이언트 (hea-pangyo, naratton, all)'
        default: 'all'
      days:
        description: '백필 일수'
        default: '1'

jobs:
  pipeline:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd scripts && npm ci

      - name: Run Pipeline
        env:
          AIRTABLE_API_KEY: ${{ secrets.AIRTABLE_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
        run: |
          cd scripts
          node pipeline/run.js \
            --client ${{ inputs.client || 'all' }} \
            --days ${{ inputs.days || '1' }}

      - name: Verify Data Integrity
        run: |
          cd scripts
          node pipeline/verify.js --days ${{ inputs.days || '1' }}

      - name: Send Notification
        if: always()
        run: |
          cd scripts
          node pipeline/notify.js --status ${{ job.status }}
```

---

## 🛡️ 에러 처리 및 복구

### 1. 자동 재시도

```javascript
async function withRetry(fn, maxAttempts = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(`시도 ${attempt}/${maxAttempts} 실패, ${delay}ms 후 재시도`);
      await sleep(delay * attempt); // 지수 백오프
    }
  }
}
```

### 2. 부분 실패 처리

```javascript
// 하나의 레코드 실패 시 전체 중단하지 않음
async function processRecords(records) {
  const results = { success: [], failed: [] };

  for (const record of records) {
    try {
      await upsert(record);
      results.success.push(record);
    } catch (error) {
      results.failed.push({ record, error: error.message });
    }
  }

  return results;
}
```

### 3. 알림 레벨

| 레벨 | 조건 | 알림 |
|------|------|------|
| ✅ 성공 | 모든 레코드 저장, 정합성 통과 | 일일 요약 |
| ⚠️ 경고 | 일부 레코드 실패 또는 정합성 ±1% | 즉시 알림 |
| ❌ 실패 | 전체 실패 또는 정합성 ±5% | 즉시 알림 + 재시도 |

---

## 📊 모니터링 대시보드

### 일일 파이프라인 상태

| 지표 | 설명 |
|------|------|
| 레코드 수 | 일일 저장된 레코드 수 |
| 정합성 점수 | Meta API vs Airtable 일치율 |
| 에러율 | 실패한 레코드 비율 |
| 실행 시간 | 파이프라인 총 소요 시간 |

### Telegram 알림 형식

```
📊 Polarad Daily Pipeline Report
━━━━━━━━━━━━━━━━━━━━━━━━━
📅 날짜: 2026-01-28
⏱️ 소요: 45초

✅ HEA 판교
   레코드: 3개 | 정합성: 100%

✅ 나라똔
   레코드: 5개 | 정합성: 100%

━━━━━━━━━━━━━━━━━━━━━━━━━
💾 총 저장: 8개 | 실패: 0개
```

---

## 📅 구현 로드맵

### Phase 1: 기반 구축 (1주)
- [ ] `lib/clients.js` - 클라이언트 설정 중앙화
- [ ] `lib/airtable-upsert.js` - Upsert 모듈
- [ ] `lib/verify.js` - 정합성 검증 모듈
- [ ] 단위 테스트 작성

### Phase 2: 파이프라인 구축 (1주)
- [ ] `pipeline/fetch.js` - Meta API 수집
- [ ] `pipeline/transform.js` - 데이터 변환
- [ ] `pipeline/run.js` - 메인 오케스트레이터
- [ ] GitHub Actions 워크플로우

### Phase 3: 모니터링 (1주)
- [ ] `pipeline/notify.js` - Telegram 알림
- [ ] 에러 추적 시스템
- [ ] 대시보드 위젯

### Phase 4: 안정화 (1주)
- [ ] E2E 테스트
- [ ] 문서화
- [ ] 운영 모드 전환

---

## ✅ 성공 기준

1. **중복 제로**: 동일 날짜/디바이스 레코드 중복 없음
2. **정합성 100%**: Meta API와 Airtable 데이터 일치
3. **자동화**: 수동 개입 없이 일일 파이프라인 실행
4. **가시성**: 모든 실행 결과 Telegram 알림

---

## 📝 관련 문서

- [데이터 파이프라인 시스템 PRD](./PRD-data-pipeline-system.md)
- [백필 시스템 PRD](./PRD-backfill-system.md)
- [트러블슈팅 아카이브](F:/troubleshooting/airtable.md)

---

**작성일**: 2026-01-28
**작성자**: Claude Opus 4.5
