/**
 * Instagram Graph API — Content Publishing
 *
 * 광고대행사 운영자가 POLA-REPORT 대시보드에서 광고주의 Instagram Business
 * 계정으로 직접 콘텐츠를 발행하는 흐름.
 *
 * 2-step publish flow:
 *   1) POST /{ig-user-id}/media           → container id
 *   2) POST /{ig-user-id}/media_publish   → publish container
 *
 * Required permissions on the user token:
 *   - instagram_basic              (or instagram_business_basic)
 *   - instagram_content_publish
 *   - pages_show_list              (to enumerate Pages → IG accounts)
 *   - pages_read_engagement        (to read connected IG account id)
 *
 * Reference:
 *   https://developers.facebook.com/docs/instagram-platform/content-publishing
 */

const API_VERSION = "v22.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

export interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
}

/**
 * Facebook Page에 연결된 Instagram Business Account id 조회.
 * Page Access Token 필요.
 */
export async function getConnectedInstagramAccount(
  pageId: string,
  pageAccessToken: string,
): Promise<InstagramAccount | null> {
  const url = `${BASE_URL}/${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      err.error?.message || "Failed to read connected IG account",
    );
  }
  const data = await res.json();
  return data.instagram_business_account || null;
}

/**
 * Step 1 — Create a media container.
 * For single image: { image_url, caption }
 * For video/reels: { video_url, caption, media_type: 'REELS' }
 */
export async function createMediaContainer(
  igUserId: string,
  accessToken: string,
  payload: {
    image_url?: string;
    video_url?: string;
    caption?: string;
    media_type?: "IMAGE" | "REELS" | "STORIES";
  },
): Promise<{ id: string }> {
  const body = new URLSearchParams();
  if (payload.image_url) body.set("image_url", payload.image_url);
  if (payload.video_url) body.set("video_url", payload.video_url);
  if (payload.caption) body.set("caption", payload.caption);
  if (payload.media_type) body.set("media_type", payload.media_type);
  body.set("access_token", accessToken);

  const res = await fetch(`${BASE_URL}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to create media container");
  }
  return res.json();
}

/**
 * Helper: poll container status until FINISHED (videos need processing).
 * Returns true on FINISHED, throws on ERROR / EXPIRED.
 */
export async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<boolean> {
  const interval = options.intervalMs ?? 2000;
  const timeout = options.timeoutMs ?? 60_000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const res = await fetch(
      `${BASE_URL}/${containerId}?fields=status_code,status&access_token=${accessToken}`,
    );
    if (res.ok) {
      const data = await res.json();
      const code = data.status_code as string | undefined;
      if (code === "FINISHED") return true;
      if (code === "ERROR" || code === "EXPIRED") {
        throw new Error(
          `Container ${code}: ${data.status || "unknown reason"}`,
        );
      }
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Container readiness timeout after ${timeout}ms`);
}

/**
 * Step 2 — Publish a previously-created container.
 */
export async function publishMediaContainer(
  igUserId: string,
  containerId: string,
  accessToken: string,
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });
  const res = await fetch(`${BASE_URL}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to publish media");
  }
  return res.json();
}

/**
 * Convenience — one-shot image publish.
 * Returns the published media id (permalink lives at /{id}?fields=permalink).
 */
export async function publishImage(params: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
}): Promise<{ media_id: string; permalink?: string }> {
  const container = await createMediaContainer(
    params.igUserId,
    params.accessToken,
    {
      image_url: params.imageUrl,
      caption: params.caption,
      media_type: "IMAGE",
    },
  );

  await waitForContainerReady(container.id, params.accessToken).catch(() => {
    // images typically don't need wait, swallow timeout
  });

  const published = await publishMediaContainer(
    params.igUserId,
    container.id,
    params.accessToken,
  );

  // optional: fetch permalink for confirmation
  let permalink: string | undefined;
  try {
    const linkRes = await fetch(
      `${BASE_URL}/${published.id}?fields=permalink&access_token=${params.accessToken}`,
    );
    if (linkRes.ok) {
      const linkData = await linkRes.json();
      permalink = linkData.permalink;
    }
  } catch {
    // permalink fetch is best-effort
  }

  return { media_id: published.id, permalink };
}

/**
 * Read recent media (for the operator to verify a post landed).
 */
export async function getRecentMedia(
  igUserId: string,
  accessToken: string,
  limit = 5,
): Promise<
  Array<{
    id: string;
    caption?: string;
    media_type: string;
    media_url?: string;
    permalink: string;
    timestamp: string;
  }>
> {
  const res = await fetch(
    `${BASE_URL}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,timestamp&limit=${limit}&access_token=${accessToken}`,
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to fetch recent media");
  }
  const data = await res.json();
  return data.data || [];
}
