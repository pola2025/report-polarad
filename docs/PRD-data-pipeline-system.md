# PRD: 통합 데이터 파이프라인 시스템

**작성일**: 2026-01-28
**버전**: 1.0
**목표**: 수동 체크 없이 안정적인 데이터 백필 및 리포트 생성

---

## 1. 현재 문제점 및 근본 원인

### 1.1 문제 → 원인 분석

```
문제: 중복 레코드 발생 (48건)
└─ 원인: Upsert 키가 일관되지 않음 (ad_id vs campaign_name)
   └─ 근본 원인: 백필 스크립트마다 키 생성 로직이 다름

문제: 환율 미적용 (47건)
└─ 원인: 일부 백필에서 환율 변환 누락
   └─ 근본 원인: 환율 로직이 스크립트마다 다르게 구현됨

문제: 수동 검증 필요
└─ 원인: 자동 검증/수정 메커니즘 없음
   └─ 근본 원인: 파이프라인 설계 자체가 없음
```

### 1.2 핵심 요구사항

> **"내가 체크하지 않아도 잘 반영되기를 원함"**

이를 위해 필요한 것:
1. **자동 감지**: 문제가 발생하면 시스템이 감지
2. **자동 수정**: 가능한 문제는 자동 수정
3. **알림**: 수동 개입 필요 시에만 알림
4. **신뢰성**: 리포트 생성 전 데이터 품질 보장

---

## 2. 시스템 설계: Self-Healing Data Pipeline

### 2.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Daily Pipeline (새벽 3시 KST)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ 1. 수집   │───▶│ 2. 검증   │───▶│ 3. 정제   │───▶│ 4. 저장   │      │
│  │ (Fetch)  │    │ (Validate)│    │ (Clean)  │    │ (Upsert) │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│       │               │               │               │              │
│       ▼               ▼               ▼               ▼              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Health Monitor                            │    │
│  │  - API 응답 체크    - 데이터 품질 체크  - 중복 체크           │    │
│  │  - 토큰 만료 체크   - 환율 적용 체크    - 저장 성공 체크       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│        ┌──────────┐   ┌──────────┐   ┌──────────┐                  │
│        │ 자동 수정 │   │ 텔레그램  │   │ 리포트   │                  │
│        │ (Auto-fix)│   │ 알림     │   │ 생성 차단│                  │
│        └──────────┘   └──────────┘   └──────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Self-Healing 규칙

| 문제 유형 | 자동 수정 가능 | 수정 방법 |
|----------|--------------|----------|
| 중복 레코드 | ✅ Yes | 최신 레코드 유지, 나머지 삭제 |
| 환율 미적용 | ✅ Yes | spend < 1000 이면 x1490 적용 |
| 필수 필드 누락 | ❌ No | 알림 후 수동 확인 |
| API 토큰 만료 | ❌ No | 긴급 알림 |
| 데이터 0건 | ⚠️ 조건부 | 주말/휴일이면 정상, 아니면 알림 |

### 2.3 데이터 품질 게이트

```
리포트 생성 전 반드시 통과해야 하는 체크:

Gate 1: 데이터 존재
├─ 해당 기간 레코드 > 0
└─ 실패 시: 리포트 생성 차단 + 알림

Gate 2: 중복 없음
├─ 같은 키의 레코드 = 1개
└─ 실패 시: 자동 중복 제거 후 재검증

Gate 3: 환율 적용됨
├─ 모든 spend >= 1000 (KRW 기준)
└─ 실패 시: 자동 환율 적용 후 재검증

Gate 4: 날짜 연속성
├─ 기간 내 빈 날짜 없음 (주말 제외)
└─ 실패 시: 경고 알림 (리포트는 생성)
```

---

## 3. 구현 상세

### 3.1 통합 파이프라인 스크립트

**파일**: `scripts/pipeline/daily-pipeline.js`

```javascript
// 파이프라인 단계
const STAGES = {
  FETCH: 'fetch',      // Meta API → Raw Data
  VALIDATE: 'validate', // 데이터 검증
  CLEAN: 'clean',      // 중복 제거, 환율 적용
  SAVE: 'save',        // Airtable 저장
  VERIFY: 'verify',    // 저장 후 검증
};

// 실행 흐름
async function runPipeline(client, dateRange) {
  const result = { client, stages: {}, issues: [], autoFixed: [] };

  // 1. Fetch
  const rawData = await fetchMetaData(client, dateRange);
  result.stages[STAGES.FETCH] = { count: rawData.length };

  // 2. Validate
  const validation = validateData(rawData);
  if (!validation.isValid) {
    result.issues.push(...validation.issues);
  }

  // 3. Clean (자동 수정)
  const { cleanedData, fixes } = cleanData(rawData);
  result.autoFixed.push(...fixes);

  // 4. Save
  const saveResult = await saveToAirtable(client, cleanedData);
  result.stages[STAGES.SAVE] = saveResult;

  // 5. Verify
  const verifyResult = await verifyAirtableData(client, dateRange);
  result.stages[STAGES.VERIFY] = verifyResult;

  return result;
}
```

### 3.2 자동 수정 함수

**중복 제거**:
```javascript
async function removeDuplicates(baseId, tableId, dateRange) {
  // 1. 중복 키 찾기
  const records = await fetchAllRecords(baseId, tableId, dateRange);
  const keyMap = new Map();

  records.forEach(r => {
    const key = generateKey(r);
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key).push(r);
  });

  // 2. 중복인 경우 최신 1개 제외 삭제
  const toDelete = [];
  keyMap.forEach((records, key) => {
    if (records.length > 1) {
      // updated_at 기준 정렬, 최신 1개 제외
      const sorted = records.sort((a, b) =>
        new Date(b.fields.updated_at || 0) - new Date(a.fields.updated_at || 0)
      );
      toDelete.push(...sorted.slice(1).map(r => r.id));
    }
  });

  // 3. 삭제 실행
  await deleteRecords(baseId, tableId, toDelete);

  return { deleted: toDelete.length };
}
```

**환율 자동 적용**:
```javascript
async function fixCurrencyIssues(baseId, tableId, dateRange) {
  const records = await fetchAllRecords(baseId, tableId, dateRange);
  const toUpdate = [];

  records.forEach(r => {
    const { spend, impressions } = r.fields;
    // 조건: impressions >= 100 이고 spend < 1000 이면 환율 미적용
    if (impressions >= 100 && spend > 0 && spend < 1000) {
      toUpdate.push({
        id: r.id,
        fields: { spend: Math.round(spend * 1490) }
      });
    }
  });

  // 배치 업데이트
  await batchUpdateRecords(baseId, tableId, toUpdate);

  return { fixed: toUpdate.length };
}
```

### 3.3 리포트 생성 전 게이트 체커

**파일**: `scripts/pipeline/report-gate.js`

```javascript
async function checkReportGate(client, reportPeriod) {
  const gates = [];

  // Gate 1: 데이터 존재
  const dataCount = await countRecords(client, reportPeriod);
  gates.push({
    name: 'data_exists',
    passed: dataCount > 0,
    value: dataCount,
    blocking: true,
  });

  // Gate 2: 중복 없음
  const duplicates = await findDuplicates(client, reportPeriod);
  gates.push({
    name: 'no_duplicates',
    passed: duplicates.length === 0,
    value: duplicates.length,
    blocking: true,
    autoFix: async () => removeDuplicates(client, reportPeriod),
  });

  // Gate 3: 환율 적용
  const currencyIssues = await findCurrencyIssues(client, reportPeriod);
  gates.push({
    name: 'currency_applied',
    passed: currencyIssues.length === 0,
    value: currencyIssues.length,
    blocking: true,
    autoFix: async () => fixCurrencyIssues(client, reportPeriod),
  });

  // Gate 4: 날짜 연속성
  const missingDates = await findMissingDates(client, reportPeriod);
  gates.push({
    name: 'date_continuity',
    passed: missingDates.length === 0,
    value: missingDates.length,
    blocking: false, // 경고만
  });

  return gates;
}

async function runGatesWithAutoFix(client, reportPeriod) {
  let gates = await checkReportGate(client, reportPeriod);
  const autoFixResults = [];

  // 실패한 게이트 중 자동 수정 가능한 것 수정
  for (const gate of gates) {
    if (!gate.passed && gate.autoFix) {
      const result = await gate.autoFix();
      autoFixResults.push({ gate: gate.name, ...result });
    }
  }

  // 재검증
  if (autoFixResults.length > 0) {
    gates = await checkReportGate(client, reportPeriod);
  }

  const allBlockingPassed = gates
    .filter(g => g.blocking)
    .every(g => g.passed);

  return {
    canGenerateReport: allBlockingPassed,
    gates,
    autoFixResults,
  };
}
```

---

## 4. 알림 정책

### 4.1 알림 레벨

| 레벨 | 조건 | 액션 |
|------|------|------|
| 🟢 INFO | 파이프라인 정상 완료 | 일일 요약 알림 (선택적) |
| 🟡 WARN | 자동 수정 발생 | 알림 + 수정 내역 |
| 🟠 ERROR | 자동 수정 실패 | 긴급 알림 |
| 🔴 CRITICAL | API 토큰 만료/시스템 장애 | 즉시 알림 + 리포트 생성 차단 |

### 4.2 알림 메시지 템플릿

```
🟢 일일 파이프라인 완료

📅 기간: 2026-01-21 ~ 2026-01-28
✅ H.E.A 판교: 21건 저장
✅ 나라똔: 28건 저장

자동 수정:
  - 중복 제거: 3건
  - 환율 적용: 5건

리포트 생성 준비 완료 ✓
```

```
🟠 파이프라인 경고

📅 기간: 2026-01-21 ~ 2026-01-28
⚠️ 나라똔: 데이터 0건

확인 필요:
  - Meta API 응답 확인
  - 캠페인 운영 상태 확인

리포트 생성 대기 중...
```

---

## 5. 스케줄 및 실행 순서

### 5.1 일일 스케줄

| 시간 (KST) | 작업 | 의존성 |
|-----------|------|--------|
| 03:00 | 데이터 파이프라인 실행 | - |
| 03:30 | 자동 수정 (필요시) | 파이프라인 완료 |
| 03:45 | 리포트 게이트 체크 | 자동 수정 완료 |
| 04:00 | (월요일) 주간 리포트 생성 | 게이트 통과 |
| 04:00 | (1일) 월간 리포트 생성 | 게이트 통과 |

### 5.2 GitHub Actions 워크플로우

```yaml
# .github/workflows/daily-pipeline.yml
name: Daily Data Pipeline

on:
  schedule:
    - cron: '0 18 * * *'  # UTC 18:00 = KST 03:00

jobs:
  pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Run Pipeline
        run: node scripts/pipeline/daily-pipeline.js

      - name: Auto-fix Issues
        run: node scripts/pipeline/auto-fix.js

      - name: Check Report Gate
        run: node scripts/pipeline/report-gate.js

      - name: Generate Reports (if gate passed)
        if: success()
        run: node scripts/pipeline/generate-reports.js
```

---

## 6. 구현 우선순위

### Phase 1: 즉시 적용 (오늘)
1. ✅ 중복 제거 스크립트 실행
2. ✅ 환율 수정 스크립트 실행
3. ✅ 기존 데이터 정상화

### Phase 2: 파이프라인 구축 (이번 주)
1. 통합 파이프라인 스크립트 작성
2. 자동 수정 로직 통합
3. GitHub Actions 워크플로우 업데이트

### Phase 3: 리포트 연동 (다음 주)
1. 리포트 생성 전 게이트 체커 연동
2. 알림 시스템 고도화
3. 모니터링 대시보드 (선택)

---

## 7. 기대 효과

| 현재 | 목표 |
|------|------|
| 수동으로 정합성 체크 | 자동 체크 + 자동 수정 |
| 문제 발생 후 발견 | 문제 발생 즉시 감지 |
| 리포트 데이터 신뢰도 불확실 | 게이트 통과 = 신뢰 가능 |
| 환율 누락 발생 | 환율 누락 불가능 |
| 중복 데이터 누적 | 중복 자동 제거 |

**최종 목표**: 사용자가 체크하지 않아도 **항상 정확한 데이터**가 유지됨

---

**문서 끝**
