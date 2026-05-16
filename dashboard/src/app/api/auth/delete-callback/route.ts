/**
 * Meta User Data Deletion Callback
 *
 * POST /api/auth/delete-callback
 *
 * Triggered when a user removes the POLA-REPORT app from their Facebook
 * Business Integrations.  Meta sends a form-encoded `signed_request`
 * (HMAC-SHA256 with the app secret).  We verify the signature, soft-delete
 * the matching client's OAuth credentials, and return the confirmation URL
 * + code as required by the Meta spec.
 *
 * Reference:
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient, TABLES } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

const APP_SECRET = process.env.META_APP_SECRET || "";
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://report.polarad.co.kr";
const ADMIN_CHAT_ID = "-1003394139746";

// ── helpers ────────────────────────────────────────────────────────────

function base64UrlDecode(input: string): Buffer {
  // Convert base64url → base64, pad, then decode
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

interface SignedRequestPayload {
  algorithm: string;
  user_id: string;
  issued_at?: number;
}

/**
 * Verify Meta signed_request and return decoded payload.
 * Throws on any failure.
 */
function verifySignedRequest(signedRequest: string): SignedRequestPayload {
  if (!APP_SECRET) {
    throw new Error("META_APP_SECRET not configured");
  }

  const [encodedSig, encodedPayload] = signedRequest.split(".");
  if (!encodedSig || !encodedPayload) {
    throw new Error("Malformed signed_request");
  }

  const expectedSig = crypto
    .createHmac("sha256", APP_SECRET)
    .update(encodedPayload)
    .digest();

  const providedSig = base64UrlDecode(encodedSig);

  if (providedSig.length !== expectedSig.length) {
    throw new Error("Signature length mismatch");
  }
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) {
    throw new Error("Signature mismatch");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));

  if (payload.algorithm !== "HMAC-SHA256") {
    throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
  }
  if (!payload.user_id) {
    throw new Error("Missing user_id in payload");
  }
  return payload as SignedRequestPayload;
}

/**
 * Soft-delete OAuth credentials tied to the Meta user.
 * Returns the number of rows updated (0 if no matching client).
 */
async function softDeleteByMetaUserId(metaUserId: string): Promise<number> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .update({
      meta_access_token: null,
      meta_token_expires_at: null,
      meta_token_updated_at: new Date().toISOString(),
      status: "expired",
      suspension_reason: "user_data_deletion_callback",
      suspended_at: new Date().toISOString(),
    })
    .eq("meta_user_id", metaUserId)
    .select("id");

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }
  return data?.length ?? 0;
}

// ── route handler ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.json(
      { error: "Expected application/x-www-form-urlencoded" },
      { status: 415 },
    );
  }

  const form = await request.formData();
  const signedRequest = form.get("signed_request");

  if (typeof signedRequest !== "string" || !signedRequest) {
    return NextResponse.json(
      { error: "Missing signed_request" },
      { status: 400 },
    );
  }

  let payload: SignedRequestPayload;
  try {
    payload = verifySignedRequest(signedRequest);
  } catch (err) {
    // Do not leak detail to caller; log internally
    console.error("[delete-callback/verify]", err);
    return NextResponse.json(
      { error: "Invalid signed_request" },
      { status: 400 },
    );
  }

  const confirmationCode = `del_${Date.now()}_${payload.user_id}`;

  try {
    const affected = await softDeleteByMetaUserId(payload.user_id);

    // Admin notification (non-blocking failure tolerated)
    try {
      await sendTelegramMessage(
        ADMIN_CHAT_ID,
        [
          "<b>[polarad-meta/delete-callback]</b>",
          `Meta User: <code>${payload.user_id}</code>`,
          `Affected clients: ${affected}`,
          `Confirmation: <code>${confirmationCode}</code>`,
          `Time: ${new Date().toISOString()}`,
        ].join("\n"),
      );
    } catch (notifyErr) {
      console.warn("[delete-callback/notify] failed", notifyErr);
    }

    return NextResponse.json({
      url: `${BASE_URL}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error("[delete-callback/delete]", err);
    // Even on internal failure, return 200 with a code so Meta does not retry
    // indefinitely; the admin notification above lets us reconcile manually.
    return NextResponse.json({
      url: `${BASE_URL}/data-deletion?code=${encodeURIComponent(confirmationCode)}&status=pending`,
      confirmation_code: confirmationCode,
    });
  }
}

/**
 * Meta also probes the URL with a GET during App Dashboard configuration.
 * Respond 200 with a simple notice so the URL passes validation.
 */
export async function GET() {
  return NextResponse.json({
    service: "POLA-REPORT data deletion callback",
    expects: "POST application/x-www-form-urlencoded with signed_request",
    docs: `${BASE_URL}/data-deletion`,
  });
}
