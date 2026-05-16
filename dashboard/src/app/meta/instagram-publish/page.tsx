"use client";

import { useEffect, useState } from "react";
import { DemoSection, DataCard, DataGrid } from "@/components/demo/DemoSection";
import {
  Instagram,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface Page {
  id: string;
  name: string;
  access_token?: string;
}

interface IgAccount {
  id: string;
  username: string;
  name?: string;
}

interface RecentMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink: string;
  timestamp: string;
}

const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?w=1080&h=1080&fit=crop";
const DEFAULT_CAPTION =
  "Posted from POLA-REPORT — agency demo of instagram_content_publish.";

export default function InstagramPublishPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [igAccount, setIgAccount] = useState<IgAccount | null>(null);
  const [recentMedia, setRecentMedia] = useState<RecentMedia[]>([]);

  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE_URL);
  const [caption, setCaption] = useState(DEFAULT_CAPTION);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    media_id: string;
    permalink?: string;
  } | null>(null);

  useEffect(() => {
    async function loadPages() {
      try {
        const res = await fetch("/api/meta?action=pages");
        const json = await res.json();
        if (!json.success)
          throw new Error(json.error || "Failed to load Pages");
        setPages(json.data || []);
        if (json.data?.length > 0) {
          setSelectedPage(json.data[0]);
        } else {
          setError("No Facebook Pages found. Connect a Page first.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Pages");
      } finally {
        setLoading(false);
      }
    }
    loadPages();
  }, []);

  useEffect(() => {
    if (!selectedPage?.id || !selectedPage?.access_token) {
      setIgAccount(null);
      setRecentMedia([]);
      return;
    }

    async function loadInstagram() {
      try {
        if (!selectedPage) return;
        const accountRes = await fetch(
          `/api/meta?action=instagram_account&pageId=${selectedPage.id}&pageToken=${encodeURIComponent(selectedPage.access_token!)}`,
        );
        const accountJson = await accountRes.json();
        if (!accountJson.success) throw new Error(accountJson.error);
        if (!accountJson.data) {
          setError("This Page has no connected Instagram Business account.");
          return;
        }
        setIgAccount(accountJson.data);

        const mediaRes = await fetch(
          `/api/meta?action=instagram_recent_media&igUserId=${accountJson.data.id}&pageToken=${encodeURIComponent(selectedPage.access_token!)}`,
        );
        const mediaJson = await mediaRes.json();
        if (mediaJson.success) {
          setRecentMedia(mediaJson.data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Instagram load failed");
      }
    }
    loadInstagram();
  }, [selectedPage]);

  async function handlePublish() {
    if (!igAccount || !selectedPage?.access_token) return;
    setPublishing(true);
    setPublishResult(null);
    setError(null);
    try {
      const res = await fetch("/api/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish_instagram_image",
          igUserId: igAccount.id,
          imageUrl,
          caption,
          pageToken: selectedPage.access_token,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Publish failed");
      setPublishResult(json.data);
      // refresh recent media
      const mediaRes = await fetch(
        `/api/meta?action=instagram_recent_media&igUserId=${igAccount.id}&pageToken=${encodeURIComponent(selectedPage.access_token)}`,
      );
      const mediaJson = await mediaRes.json();
      if (mediaJson.success) setRecentMedia(mediaJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <DemoSection
      permission="instagram_content_publish"
      title="Publish to Instagram Business Account"
      description="With instagram_basic + instagram_content_publish, POLA-REPORT lets agency operators publish image posts to the client's Instagram Business account directly from the analytics dashboard. The flow is server-to-server using the Page Access Token attached to the connected Instagram Business account."
      apiEndpoint="POST https://graph.facebook.com/v22.0/{ig-user-id}/media → /media_publish"
      apiFields={["image_url", "caption", "creation_id (POST publish)"]}
      userBenefit="Agencies can publish approved creative to client Instagram accounts without leaving POLA-REPORT, keeping the entire campaign workflow (planning, performance review, publishing) in one place."
      status={
        loading ? "loading" : error ? "error" : igAccount ? "success" : "error"
      }
      error={error}
    >
      <div className="space-y-6">
        {/* Page picker */}
        {pages.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-200">
            <h4 className="font-medium text-pink-900 mb-2 text-sm">
              Choose a connected Page
            </h4>
            <select
              className="w-full border border-pink-200 rounded-md px-3 py-2 text-sm"
              value={selectedPage?.id || ""}
              onChange={(e) =>
                setSelectedPage(
                  pages.find((p) => p.id === e.target.value) || null,
                )
              }
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* IG account card */}
        {igAccount && (
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-pink-100 rounded-lg">
                <Instagram className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  Connected IG Business Account
                </p>
                <h3 className="text-lg font-semibold text-gray-900">
                  @{igAccount.username}
                </h3>
              </div>
            </div>
            <DataGrid>
              <DataCard label="IG User ID" value={igAccount.id} highlight />
              {igAccount.name && (
                <DataCard label="Display Name" value={igAccount.name} />
              )}
            </DataGrid>
          </div>
        )}

        {/* Publish form */}
        {igAccount && (
          <div className="p-4 border rounded-lg space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-pink-500" />
              Publish an image post
            </h4>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Image URL
              </label>
              <input
                type="url"
                className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-gray-400 mt-1">
                Public URL of a JPEG / PNG (1080×1080 recommended).
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Caption
              </label>
              <textarea
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>

            <button
              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-md text-sm font-medium hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 flex items-center gap-2"
              disabled={publishing || !imageUrl}
              onClick={handlePublish}
            >
              <Send className="w-4 h-4" />
              {publishing ? "Publishing…" : "Publish to Instagram"}
            </button>

            {publishResult && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-800">
                    Published. Media ID: {publishResult.media_id}
                  </p>
                  {publishResult.permalink && (
                    <a
                      href={publishResult.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-700 underline inline-flex items-center gap-1"
                    >
                      Open on Instagram <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent media */}
        {recentMedia.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              Recent posts on this account
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {recentMedia.map((m) => (
                <a
                  key={m.id}
                  href={m.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border rounded-md overflow-hidden hover:border-pink-300 transition-colors"
                >
                  {m.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.media_url}
                      alt={m.caption?.slice(0, 50) || "post"}
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                      {m.media_type}
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs text-gray-500 truncate">
                      {new Date(m.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* How this data is used */}
        <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
          <h4 className="font-medium text-pink-800 mb-2">
            How POLA-REPORT uses this permission:
          </h4>
          <ul className="text-sm text-pink-700 space-y-1">
            <li>
              • Resolve the IG Business account connected to the client&apos;s
              Facebook Page
            </li>
            <li>
              • Create a media container with the approved image and caption
            </li>
            <li>• Publish the container to the client&apos;s Instagram feed</li>
            <li>
              • Display the post permalink so the operator can verify the result
            </li>
          </ul>
        </div>
      </div>
    </DemoSection>
  );
}
