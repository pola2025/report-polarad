const https = require('https');

const TELEGRAM_BOT_TOKEN = 'process.env.TELEGRAM_BOT_TOKEN';
const CHAT_ID = '-1003400452372';
const REPORT_BASE_URL = 'https://report.polarad.co.kr';

// 12월 2주차 리포트 ID
const WEEK2_REPORT_ID = '9ccefce5-9c8d-4a0d-9974-9f8914616316';

function sendTelegramMessage(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.ok) {
          resolve(result);
        } else {
          reject(new Error(result.description));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const message = `📊 <b>H.E.A 판교 광고 성과 리포트 안내</b>

안녕하세요, 폴라애드 광고운영팀입니다.
${dateStr} 기준 리포트가 발행되었습니다.

━━━━━━━━━━━━━━━━━━━━

📅 <b>12월 2주차 주간 리포트</b>
   기간: 2025.12.08 ~ 2025.12.14

   • 총 노출: 30,118회 (+17.9%)
   • 총 클릭: 909회 (+12.1%)
   • CTR: 3.02% (매우 우수!)
   • 광고비: 약 17.3만원
   • CPC: 약 190원

   🔗 <a href="${REPORT_BASE_URL}/report/monthly/${WEEK2_REPORT_ID}">리포트 보기</a>

━━━━━━━━━━━━━━━━━━━━

🎯 <b>주간 하이라이트</b>
   • 월요일 CTR 3.41%로 최고 효율
   • 일요일 클릭 157건 최다 기록
   • 전주 대비 노출/클릭 모두 증가

💡 <b>AI 분석 요약</b>
CTR 3.02%는 업계 평균(1.5~2.0%) 대비 매우 우수한 성과입니다.
연말 성수기를 맞아 현재 예산 유지 또는 10-15% 증액을 권장드립니다.
일요일 성과가 특히 좋으니 주말 예산 집중 배분을 고려해 주세요.

━━━━━━━━━━━━━━━━━━━━

📍 전체 리포트 목록: <a href="${REPORT_BASE_URL}/?client=hea-pangyo">대시보드 바로가기</a>

<i>* 12월 네이버 키워드 데이터는 월 마감 후 업데이트됩니다.</i>`;

  try {
    console.log('텔레그램 메시지 발송 중...');
    await sendTelegramMessage(message);
    console.log('✅ 텔레그램 메시지 발송 완료!');
    console.log('\n발송 내용:');
    console.log('- 12월 2주차 주간 리포트 (12/8~12/14)');
    console.log('- 총 노출: 30,118회, 클릭: 909회, CTR: 3.02%');
    console.log(`- 리포트 URL: ${REPORT_BASE_URL}/report/monthly/${WEEK2_REPORT_ID}`);
  } catch (err) {
    console.error('❌ 텔레그램 발송 실패:', err.message);
  }
}

main();
