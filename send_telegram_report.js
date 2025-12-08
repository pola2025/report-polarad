const https = require('https');

const TELEGRAM_BOT_TOKEN = '7947112373:AAEs5o3fcm0JoPewh7K5YTUwzq4poWw97pY';
const CHAT_ID = '-1003400452372';
const REPORT_BASE_URL = 'https://report.polarad.co.kr';

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

  // 12월 1주차 주간 리포트 + 11월 월간 리포트 안내 메시지
  const message = `📊 <b>H.E.A 판교 광고 성과 리포트 안내</b>

안녕하세요, 폴라애드 광고운영팀입니다.
${dateStr} 기준 리포트가 발행되었습니다.

━━━━━━━━━━━━━━━━━━━━

📅 <b>12월 1주차 주간 리포트</b>
   기간: 2025.12.01 ~ 2025.12.07

   • 총 노출: 25,541회
   • 총 클릭: 578회
   • CTR: 2.26%
   • 광고비: 약 14만원

   🔗 <a href="${REPORT_BASE_URL}/report/monthly/aef526b7-3326-4cca-ae98-f91d360a1d72">리포트 보기</a>

━━━━━━━━━━━━━━━━━━━━

📅 <b>11월 월간 리포트</b>
   기간: 2025.11.01 ~ 2025.11.30

   • 총 노출: 215,572회
   • 총 클릭: 4,790회
   • CTR: 2.22%
   • 총 광고비: 약 155만원
   • 영상 조회수: 51,985회

   🔗 <a href="${REPORT_BASE_URL}/report/monthly/1a7a5ff2-a5eb-40f3-9d10-7831bdf4de70">리포트 보기</a>

━━━━━━━━━━━━━━━━━━━━

💡 <b>AI 분석 요약</b>
12월 첫째 주는 예산 조정에 따라 노출이 감소했으나, CTR 2.26%로 안정적인 효율을 유지하고 있습니다. 연말 성수기를 맞아 예산 확대를 권장드립니다.

📍 전체 리포트 목록: <a href="${REPORT_BASE_URL}/?client=hea-pangyo">대시보드 바로가기</a>

<i>* 12월 네이버 키워드 데이터는 월 마감 후 업데이트됩니다.</i>`;

  try {
    console.log('텔레그램 메시지 발송 중...');
    await sendTelegramMessage(message);
    console.log('✅ 텔레그램 메시지 발송 완료!');
  } catch (err) {
    console.error('❌ 텔레그램 발송 실패:', err.message);
  }
}

main();
