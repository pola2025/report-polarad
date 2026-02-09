#!/usr/bin/env node
/**
 * BAS 리포트 AI 인사이트 생성 스크립트
 * telegram_reports에서 ai_insights가 null인 BAS 리포트를 찾아 Gemini로 생성
 *
 * 사용법:
 *   node generate-bas-insights.js            # ai_insights 없는 리포트만
 *   node generate-bas-insights.js --force    # 전체 재생성
 *   node generate-bas-insights.js --id UUID  # 특정 리포트만
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const BAS_CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

function buildPrompt(report) {
  const rd = report.report_data;
  if (!rd || !rd.summary) return null;

  const s = rd.summary;
  const typeLabel = report.report_type === 'monthly' ? '월간' : '주간';

  // 일별 성과
  const dailyLines = (rd.daily_stats || [])
    .map(d => `  ${d.date}: 노출 ${d.impressions}, 클릭 ${d.clicks}, 리드 ${d.leads}, 지출 $${d.spend.toFixed(2)}${d.cpl ? `, CPL $${d.cpl}` : ''}`)
    .join('\n');

  // 광고별 성과
  const adLines = (rd.ad_performance || [])
    .slice(0, 10)
    .map(a => `  ${a.ad_name || a.ad_id}: 리드 ${a.leads}, 지출 $${a.spend}, CPL ${a.cpl ? '$' + a.cpl : 'N/A'}, CTR ${a.ctr}%, 리드비중 ${a.lead_percent}%, 지출비중 ${a.spend_percent}%`)
    .join('\n');

  // 캠페인별 성과
  const campLines = (rd.campaign_performance || [])
    .map(c => `  ${c.campaign_name}: 리드 ${c.leads}, 지출 $${c.spend}, CPL ${c.cpl ? '$' + c.cpl : 'N/A'}, 리드비중 ${c.lead_percent}%, 지출비중 ${c.spend_percent}%`)
    .join('\n');

  // 전주/전월 비교
  let comparisonText = '';
  if (rd.comparison) {
    const c = rd.comparison;
    comparisonText = `
## 이전 기간 비교
- 이전 리드: ${c.prev_leads}건, 이전 지출: $${c.prev_spend}, 이전 CPL: $${c.prev_cpl}
- 변화율: 리드 ${report.leads_change > 0 ? '+' : ''}${report.leads_change}%, 지출 ${report.spend_change > 0 ? '+' : ''}${report.spend_change}%, CPL ${report.cpl_change > 0 ? '+' : ''}${report.cpl_change}%`;
  }

  return `당신은 Meta 광고 성과 분석 전문가입니다. 아래 BAS(비즈액터스쿨) ${typeLabel} 리포트 데이터를 분석하여 마케팅 담당자에게 실용적인 인사이트를 제공해주세요.

## 리포트 정보
- 고객사: BAS (비즈액터스쿨)
- 업종: 보험 영업 교육 (리드 수집형)
- 기간: ${report.week_start} ~ ${report.week_end}
- 타입: ${typeLabel} 리포트

## 종합 성과
- 노출수: ${s.impressions.toLocaleString()}회
- 클릭수: ${s.clicks.toLocaleString()}회
- 리드: ${s.leads}건
- 지출: $${s.spend.toLocaleString()}
- CPL: $${s.cpl}
- CTR: ${s.ctr}%
- 전환율: ${s.conversion_rate}%
${comparisonText}

## 일별 성과
${dailyLines || '(없음)'}

## 광고별 성과
${adLines || '(없음)'}

## 캠페인별 성과
${campLines || '(없음)'}

---

위 데이터를 분석하여 아래 형식으로 **마크다운 텍스트**를 작성하세요. JSON이 아닌 순수 텍스트로 응답하세요.

### 📊 성과 종합 분석
(전체 성과를 3~4문장으로 요약. 이전 기간 대비 변화, 핵심 수치 포함)

### 💡 핵심 인사이트
(번호 리스트로 5~6개. 각 항목은 구체적 수치와 분석 포함)

### 🎯 즉시 실행 가능한 액션
(번호 리스트로 2~3개. 각 항목에 제목 + 상세 설명 + 실행 방법)

**중요**:
- 모든 금액은 달러($)로 표시
- 구체적 수치 필수 포함
- 광고별 성과 차이 분석 필수
- 고비용/저효율 광고 지적 필수
- 마크다운 서식(**볼드**, 번호리스트) 자유롭게 사용`;
}

async function generateInsight(report) {
  const prompt = buildPrompt(report);
  if (!prompt) {
    console.log(`   ⚠️ report_data 없음 - 스킵`);
    return null;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text.trim();
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const idIdx = args.indexOf('--id');
  const targetId = idIdx !== -1 ? args[idIdx + 1] : null;

  console.log('🤖 BAS AI 인사이트 생성\n');

  // 대상 리포트 조회
  let query = supabase
    .from('telegram_reports')
    .select('*')
    .eq('client_id', BAS_CLIENT_ID)
    .order('week_start', { ascending: false });

  if (targetId) {
    query = query.eq('id', targetId);
  } else if (!force) {
    query = query.is('ai_insights', null);
  }

  const { data: reports, error } = await query;

  if (error) {
    console.error('DB 조회 실패:', error.message);
    return;
  }

  if (!reports || reports.length === 0) {
    console.log('✅ AI 인사이트가 필요한 리포트가 없습니다.');
    return;
  }

  console.log(`📋 대상: ${reports.length}건\n`);

  let success = 0;
  for (const report of reports) {
    const label = `${report.report_type === 'monthly' ? '월간' : '주간'} ${report.week_start} ~ ${report.week_end}`;
    console.log(`📊 ${label}`);

    try {
      const insight = await generateInsight(report);
      if (!insight) continue;

      // DB 업데이트
      const { error: updateError } = await supabase
        .from('telegram_reports')
        .update({ ai_insights: insight })
        .eq('id', report.id);

      if (updateError) {
        console.log(`   ❌ 저장 실패: ${updateError.message}`);
        continue;
      }

      console.log(`   ✅ 저장 완료 (${insight.length}자)`);
      success++;

      // rate limit 방지
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`   ❌ 생성 실패: ${e.message}`);
    }
  }

  console.log(`\n🎉 완료: ${success}/${reports.length}건 생성`);
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
