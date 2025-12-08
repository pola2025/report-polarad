/**
 * 환율 및 통화 관련 상수
 */

// USD -> KRW 고정 환율
export const USD_TO_KRW_RATE = 1500

/**
 * USD를 KRW로 변환
 */
export function convertUsdToKrw(usdAmount: number): number {
  return Math.round(usdAmount * USD_TO_KRW_RATE)
}

/**
 * 광고비 표시 형식 (USD + KRW)
 * 예: "$150.00 (₩225,000)"
 */
export function formatSpendWithKrw(usdAmount: number): string {
  const krwAmount = convertUsdToKrw(usdAmount)
  return `$${usdAmount.toFixed(2)} (₩${krwAmount.toLocaleString()})`
}
