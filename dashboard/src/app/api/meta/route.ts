export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getPages,
  getBusinesses,
  getBusinessDetails,
  getPageInsights,
  getPageDetails,
  getAdAccounts,
  getAdCampaigns,
  getCampaignInsights,
  getUserInfo,
  updateCampaignStatus,
} from "@/lib/meta-oauth";
import {
  getConnectedInstagramAccount,
  publishImage,
  publishReel,
  getRecentMedia,
} from "@/lib/instagram-publish";

/**
 * Meta 앱 검수용 데모 API
 *
 * 각 권한별로 API 호출 결과를 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const accessToken =
      searchParams.get("token") || process.env.META_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Access token is required" },
        { status: 400 },
      );
    }

    switch (action) {
      // 사용자 정보 (public_profile)
      case "user": {
        const user = await getUserInfo(accessToken);
        return NextResponse.json({ success: true, data: user });
      }

      // 페이지 목록 (pages_show_list)
      case "pages": {
        const pages = await getPages(accessToken);
        return NextResponse.json({ success: true, data: pages });
      }

      // 페이지 상세 정보
      case "page_details": {
        const pageId = searchParams.get("pageId");
        if (!pageId) {
          return NextResponse.json(
            { success: false, error: "pageId is required" },
            { status: 400 },
          );
        }
        const details = await getPageDetails(pageId, accessToken);
        return NextResponse.json({ success: true, data: details });
      }

      // 페이지 인사이트 (pages_read_engagement)
      case "page_insights": {
        const pageId = searchParams.get("pageId");
        const pageToken = searchParams.get("pageToken");
        if (!pageId || !pageToken) {
          return NextResponse.json(
            { success: false, error: "pageId and pageToken are required" },
            { status: 400 },
          );
        }
        const insights = await getPageInsights(pageId, pageToken);
        return NextResponse.json({ success: true, data: insights });
      }

      // 비즈니스 목록 (business_management)
      case "businesses": {
        const businesses = await getBusinesses(accessToken);
        return NextResponse.json({ success: true, data: businesses });
      }

      // 비즈니스 상세 (business_management)
      case "business_details": {
        const businessId = searchParams.get("businessId");
        if (!businessId) {
          return NextResponse.json(
            { success: false, error: "businessId is required" },
            { status: 400 },
          );
        }
        const details = await getBusinessDetails(businessId, accessToken);
        return NextResponse.json({ success: true, data: details });
      }

      // 광고 계정 목록 (ads_read)
      case "ad_accounts": {
        const accounts = await getAdAccounts(accessToken);
        return NextResponse.json({ success: true, data: accounts });
      }

      // 광고 캠페인 목록 (ads_read)
      case "campaigns": {
        const adAccountId = searchParams.get("adAccountId");
        if (!adAccountId) {
          return NextResponse.json(
            { success: false, error: "adAccountId is required" },
            { status: 400 },
          );
        }
        const campaigns = await getAdCampaigns(adAccountId, accessToken);
        return NextResponse.json({ success: true, data: campaigns });
      }

      // 캠페인 인사이트 (ads_read)
      case "campaign_insights": {
        const campaignId = searchParams.get("campaignId");
        if (!campaignId) {
          return NextResponse.json(
            { success: false, error: "campaignId is required" },
            { status: 400 },
          );
        }
        const insights = await getCampaignInsights(campaignId, accessToken);
        return NextResponse.json({ success: true, data: insights });
      }

      // Instagram Business 계정 조회 (instagram_basic)
      case "instagram_account": {
        const pageId = searchParams.get("pageId");
        const pageToken = searchParams.get("pageToken");
        if (!pageId || !pageToken) {
          return NextResponse.json(
            { success: false, error: "pageId and pageToken are required" },
            { status: 400 },
          );
        }
        const account = await getConnectedInstagramAccount(pageId, pageToken);
        return NextResponse.json({ success: true, data: account });
      }

      // Instagram 최근 게시물 조회 (instagram_basic)
      case "instagram_recent_media": {
        const igUserId = searchParams.get("igUserId");
        const pageToken = searchParams.get("pageToken") || accessToken;
        if (!igUserId) {
          return NextResponse.json(
            { success: false, error: "igUserId is required" },
            { status: 400 },
          );
        }
        const media = await getRecentMedia(igUserId, pageToken);
        return NextResponse.json({ success: true, data: media });
      }

      // 전체 데이터 조회 (데모 페이지용)
      case "all":
      default: {
        const [user, pages, businesses, adAccounts] = await Promise.all([
          getUserInfo(accessToken).catch(() => null),
          getPages(accessToken).catch(() => []),
          getBusinesses(accessToken).catch(() => []),
          getAdAccounts(accessToken).catch(() => []),
        ]);

        // 첫 번째 페이지의 인사이트 조회 (있는 경우)
        let pageInsights = null;
        let pageDetails = null;
        if (pages.length > 0) {
          // 페이지 상세 정보 조회 (pages_read_engagement 증빙용)
          pageDetails = await getPageDetails(pages[0].id, accessToken).catch(
            () => null,
          );

          if (pages[0].access_token) {
            pageInsights = await getPageInsights(
              pages[0].id,
              pages[0].access_token,
            ).catch(() => null);
          }
        }

        // 첫 번째 비즈니스의 상세 조회 (있는 경우)
        let businessDetails = null;
        if (businesses.length > 0) {
          businessDetails = await getBusinessDetails(
            businesses[0].id,
            accessToken,
          ).catch(() => null);
        }

        return NextResponse.json({
          success: true,
          data: {
            user,
            pages,
            pageInsights,
            pageDetails,
            businesses,
            businessDetails,
            adAccounts,
          },
        });
      }
    }
  } catch (error) {
    console.error("Demo API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * 캠페인 상태 변경 (ads_management)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, campaignId, status } = body;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Access token is required" },
        { status: 400 },
      );
    }

    if (action === "update_campaign_status") {
      if (!campaignId || !status) {
        return NextResponse.json(
          { success: false, error: "campaignId and status are required" },
          { status: 400 },
        );
      }

      await updateCampaignStatus(campaignId, status, accessToken);
      return NextResponse.json({ success: true });
    }

    if (action === "publish_instagram_image") {
      const { igUserId, imageUrl, caption, pageToken } = body;
      if (!igUserId || !imageUrl) {
        return NextResponse.json(
          { success: false, error: "igUserId and imageUrl are required" },
          { status: 400 },
        );
      }
      const result = await publishImage({
        igUserId,
        accessToken: pageToken || accessToken,
        imageUrl,
        caption,
      });
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "publish_instagram_reel") {
      const { igUserId, videoUrl, caption, pageToken } = body;
      if (!igUserId || !videoUrl) {
        return NextResponse.json(
          { success: false, error: "igUserId and videoUrl are required" },
          { status: 400 },
        );
      }
      const result = await publishReel({
        igUserId,
        accessToken: pageToken || accessToken,
        videoUrl,
        caption,
      });
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Campaign update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
