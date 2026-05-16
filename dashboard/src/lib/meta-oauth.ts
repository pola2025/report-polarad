/**
 * Meta OAuth 유틸리티
 *
 * Meta Ads API OAuth 인증 플로우 관리
 */

import crypto from "crypto";

// 환경변수
const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_META_REDIRECT_URI ||
  "https://report.polarad.co.kr/api/auth/callback";

// Meta Graph API 버전
const API_VERSION = "v22.0";

// OAuth 스코프 (App Review 5개 권한 + public_profile)
const OAUTH_SCOPE = [
  "public_profile",
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

/**
 * CSRF 방지용 state 토큰 생성
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Meta OAuth 로그인 URL 생성
 */
export function getOAuthLoginUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: OAUTH_SCOPE,
    state: state,
    response_type: "code",
  });

  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Authorization Code로 Access Token 교환
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in?: number;
}> {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: REDIRECT_URI,
    code: code,
  });

  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/oauth/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Token exchange failed");
  }

  return response.json();
}

/**
 * Short-lived Token을 Long-lived Token으로 교환 (60일 유효)
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/oauth/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Long-lived token exchange failed");
  }

  return response.json();
}

/**
 * Access Token 갱신 (Long-lived Token → 새 Long-lived Token)
 */
export async function refreshAccessToken(currentToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  // Long-lived token은 만료 전에 동일한 방식으로 갱신
  return exchangeForLongLivedToken(currentToken);
}

/**
 * Access Token 유효성 검증
 */
export async function validateToken(accessToken: string): Promise<{
  isValid: boolean;
  userId?: string;
  scopes?: string[];
  expiresAt?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`,
    );

    if (!response.ok) {
      return { isValid: false, error: "Token validation request failed" };
    }

    const data = await response.json();
    const tokenData = data.data;

    if (!tokenData.is_valid) {
      return {
        isValid: false,
        error: tokenData.error?.message || "Token is invalid",
      };
    }

    return {
      isValid: true,
      userId: tokenData.user_id,
      scopes: tokenData.scopes,
      expiresAt: tokenData.expires_at,
    };
  } catch (error) {
    return { isValid: false, error: String(error) };
  }
}

/**
 * 사용자의 광고 계정 목록 조회
 */
export async function getAdAccounts(accessToken: string): Promise<
  Array<{
    id: string;
    account_id: string;
    name: string;
    account_status: number;
  }>
> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me/adaccounts?fields=id,account_id,name,account_status&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch ad accounts");
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Meta 사용자 정보 조회
 */
export async function getUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  email?: string;
}> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me?fields=id,name,email&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch user info");
  }

  return response.json();
}

/**
 * 토큰 만료까지 남은 시간 (일 단위)
 */
export function getDaysUntilExpiry(
  expiresAt: Date | string | null,
): number | null {
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 토큰 만료 임박 여부 (7일 이내)
 */
export function isTokenExpiringSoon(expiresAt: Date | string | null): boolean {
  const daysLeft = getDaysUntilExpiry(expiresAt);
  return daysLeft !== null && daysLeft <= 7;
}

/**
 * 토큰 만료 여부
 */
export function isTokenExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return true;

  const expiry = new Date(expiresAt);
  return new Date() > expiry;
}

/**
 * 사용자의 Facebook 페이지 목록 조회 (pages_show_list)
 */
export async function getPages(accessToken: string): Promise<
  Array<{
    id: string;
    name: string;
    category: string;
    access_token?: string;
    tasks?: string[];
  }>
> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me/accounts?fields=id,name,category,access_token,tasks&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch pages");
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * 사용자의 비즈니스 목록 조회 (business_management)
 */
export async function getBusinesses(accessToken: string): Promise<
  Array<{
    id: string;
    name: string;
    verification_status: string;
    created_time: string;
  }>
> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me/businesses?fields=id,name,verification_status,created_time&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch businesses");
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * 비즈니스 상세 정보 조회 (business_management)
 */
export async function getBusinessDetails(
  businessId: string,
  accessToken: string,
): Promise<{
  id: string;
  name: string;
  verification_status: string;
  created_time: string;
  primary_page?: { id: string; name: string };
  owned_ad_accounts?: {
    data: Array<{ id: string; name: string; account_status: number }>;
  };
  owned_pages?: { data: Array<{ id: string; name: string }> };
}> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${businessId}?fields=id,name,verification_status,created_time,primary_page,owned_ad_accounts{id,name,account_status},owned_pages{id,name}&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch business details");
  }

  return response.json();
}

/**
 * 페이지 인사이트 조회 (pages_read_engagement)
 *
 * Note: Some metrics require specific period values:
 * - page_fans: lifetime only
 * - page_impressions, page_engaged_users, page_post_engagements: day, week, days_28
 */
export async function getPageInsights(
  pageId: string,
  pageAccessToken: string,
  period: "day" | "week" | "days_28" = "days_28",
): Promise<{
  page_impressions?: number;
  page_engaged_users?: number;
  page_fans?: number;
  page_post_engagements?: number;
}> {
  // 일반 메트릭 (period 필요)
  const periodMetrics = [
    "page_impressions",
    "page_engaged_users",
    "page_post_engagements",
  ].join(",");

  // Lifetime 메트릭 (별도 요청)
  const lifetimeMetrics = ["page_fans"];

  const results: Record<string, number> = {};

  try {
    // Period 메트릭 조회
    const periodResponse = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pageId}/insights?metric=${periodMetrics}&period=${period}&access_token=${pageAccessToken}`,
    );

    if (periodResponse.ok) {
      const periodData = await periodResponse.json();
      for (const item of periodData.data || []) {
        if (item.values && item.values.length > 0) {
          results[item.name] = item.values[item.values.length - 1].value || 0;
        }
      }
    }

    // Lifetime 메트릭 조회
    const lifetimeResponse = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pageId}/insights?metric=${lifetimeMetrics.join(",")}&period=lifetime&access_token=${pageAccessToken}`,
    );

    if (lifetimeResponse.ok) {
      const lifetimeData = await lifetimeResponse.json();
      for (const item of lifetimeData.data || []) {
        if (item.values && item.values.length > 0) {
          results[item.name] = item.values[item.values.length - 1].value || 0;
        }
      }
    }
  } catch (error) {
    console.error("Page insights error:", error);
  }

  return results;
}

/**
 * 페이지 기본 정보 조회
 */
export async function getPageDetails(
  pageId: string,
  accessToken: string,
): Promise<{
  id: string;
  name: string;
  category: string;
  followers_count?: number;
  fan_count?: number;
  about?: string;
  website?: string;
}> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${pageId}?fields=id,name,category,followers_count,fan_count,about,website&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch page details");
  }

  return response.json();
}

/**
 * 광고 캠페인 목록 조회 (ads_read)
 */
export async function getAdCampaigns(
  adAccountId: string,
  accessToken: string,
): Promise<
  Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    created_time: string;
    daily_budget?: string;
    lifetime_budget?: string;
  }>
> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${adAccountId}/campaigns?fields=id,name,status,objective,created_time,daily_budget,lifetime_budget&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch campaigns");
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * 캠페인 상태 변경 (ads_management)
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
  accessToken: string,
): Promise<{ success: boolean }> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${campaignId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        status: status,
        access_token: accessToken,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update campaign status");
  }

  return { success: true };
}

/**
 * 광고 캠페인 성과 조회 (ads_read)
 */
export async function getCampaignInsights(
  campaignId: string,
  accessToken: string,
  datePreset: string = "last_30d",
): Promise<{
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
}> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${campaignId}/insights?fields=impressions,clicks,spend,reach,ctr,cpc&date_preset=${datePreset}&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to fetch campaign insights",
    );
  }

  const data = await response.json();
  return data.data?.[0] || {};
}
