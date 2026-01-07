#!/usr/bin/env node
/**
 * Polarad - 네이버 광고 예산 소진 알림 스크립트
 *
 * 비즈머니 잔액이 3만원 이하면 텔레그램으로 예산 충전 안내 발송
 *
 * 사용법:
 *   node naver-budget-alert.js              # 현재 잔액 체크
 *   node naver-budget-alert.js --test       # 테스트 (알림 안 보냄)
 *
 * 자동화:
 *   매일 오전 9시에 실행하도록 Windows 작업 스케줄러 설정
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const crypto = require('crypto');

// 네이버 API 설정
const NAVER_API_BASE = 'https://api.searchad.naver.com';
const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID;
const API_KEY = process.env.NAVER_API_KEY;
const SECRET_KEY = process.env.NAVER_SECRET_KEY;

// 텔레그램 설정
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BUDGET_ALERT_CHAT_ID = '-1003400452372';

// 예산 임계값 (원)
const BUDGET_THRESHOLD = 30000;

// 충전 계좌 정보
const BANK_INFO = {
  bank: '국민은행',
  account: '74059072976034',
};

/**
 * 네이버 API Signature 생성
 */
function generateSignature(timestamp, method, uri) {
  const message = `${timestamp}.${method}.${uri}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * 네이버 API 호출
 */
async function callNaverAPI(method, uri) {
  const timestamp = String(Date.now());
  const signature = generateSignature(timestamp, method, uri);

  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': API_KEY,
    'X-Customer': CUSTOMER_ID,
    'X-Signature': signature,
  };

  const response = await fetch(`${NAVER_API_BASE}${uri}`, { method, headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Naver API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * 비즈머니 잔액 조회
 */
async function getBizmoneyBalance() {
  const result = await callNaverAPI('GET', '/billing/bizmoney');
  return {
    balance: result.bizmoney || 0,
    customerId: result.customerId,
    budgetLock: result.budgetLock,
  };
}

/**
 * 텔레그램 메시지 전송
 */
async function sendTelegramMessage(chatId, message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API Error: ${error}`);
    }

    console.log('✅ 텔레그램 알림 전송 완료');
    return true;
  } catch (error) {
    console.error('❌ 텔레그램 전송 실패:', error.message);
    return false;
  }
}

/**
 * 예산 부족 알림 메시지 생성
 */
function createAlertMessage(balance) {
  const formattedBalance = balance.toLocaleString();
  const threshold = BUDGET_THRESHOLD.toLocaleString();

  return `
⚠️ <b>네이버 광고 예산 부족 알림</b>

💰 현재 잔액: <b>${formattedBalance}원</b>
📉 기준: ${threshold}원 이하

광고 예산이 부족하여 노출이 제한될 수 있습니다.

━━━━━━━━━━━━━━━━━━━━
💳 <b>충전 계좌 정보</b>
은행: ${BANK_INFO.bank}
계좌: <code>${BANK_INFO.account}</code>
━━━━━━━━━━━━━━━━━━━━

광고 예산을 충전해 주세요.
  `.trim();
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🔍 네이버 광고 비즈머니 잔액 체크\n');

  // 테스트 모드 확인
  const isTestMode = process.argv.includes('--test');
  if (isTestMode) {
    console.log('⚠️ 테스트 모드 - 알림을 보내지 않습니다.\n');
  }

  // 환경변수 확인
  if (!CUSTOMER_ID || !API_KEY || !SECRET_KEY) {
    console.error('❌ 환경변수 설정 필요: NAVER_CUSTOMER_ID, NAVER_API_KEY, NAVER_SECRET_KEY');
    return;
  }

  try {
    // 비즈머니 잔액 조회
    const { balance, customerId } = await getBizmoneyBalance();

    console.log(`👤 고객 ID: ${customerId}`);
    console.log(`💰 현재 잔액: ${balance.toLocaleString()}원`);
    console.log(`📉 임계값: ${BUDGET_THRESHOLD.toLocaleString()}원\n`);

    if (balance <= BUDGET_THRESHOLD) {
      console.log('🚨 예산 부족! 알림 발송 필요');

      if (!isTestMode) {
        const message = createAlertMessage(balance);
        await sendTelegramMessage(BUDGET_ALERT_CHAT_ID, message);
      } else {
        console.log('(테스트 모드로 알림 생략)');
      }
    } else {
      console.log('✅ 예산 충분 (알림 불필요)');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);

    if (!isTestMode) {
      await sendTelegramMessage(
        BUDGET_ALERT_CHAT_ID,
        `❌ <b>예산 체크 오류</b>\n\n오류: ${error.message}`
      );
    }
  }

  console.log('\n완료!');
}

main().catch(console.error);
