import Link from "next/link";

export const metadata = {
  title: "Data Deletion Instructions — POLA-REPORT",
  description: "How to request deletion of your data from POLA-REPORT.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-neutral-900">
            POLA-REPORT
          </Link>
          <nav className="text-sm text-neutral-500 flex gap-4">
            <Link href="/privacy" className="hover:text-neutral-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-neutral-900">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <article className="prose prose-neutral max-w-none">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Data Deletion Instructions
          </h1>
          <p className="text-sm text-neutral-500">Last updated: May 16, 2026</p>

          <div className="my-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-medium text-blue-900 mb-1">In one sentence</p>
            <p className="text-blue-800">
              Revoke POLA-REPORT in your Facebook App Settings or email{" "}
              <a href="mailto:privacy@polarad.co.kr" className="underline">
                privacy@polarad.co.kr
              </a>{" "}
              and we will erase the data within 30 days.
            </p>
          </div>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            Option 1 — Revoke through Facebook (automatic)
          </h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              Go to{" "}
              <a
                href="https://www.facebook.com/settings?tab=business_tools"
                className="text-blue-600 hover:underline"
              >
                Facebook &rarr; Settings &amp; privacy &rarr; Business
                Integrations
              </a>
            </li>
            <li>
              Find <strong>POLA-REPORT</strong> in the list
            </li>
            <li>
              Click <em>View and edit</em> &rarr; <em>Remove</em>
            </li>
          </ol>
          <p>
            Facebook will then notify our server-to-server deletion callback at{" "}
            <code className="text-xs bg-neutral-100 px-1 py-0.5 rounded">
              POST https://report.polarad.co.kr/api/auth/delete-callback
            </code>
            . We immediately delete the connecting user&apos;s access tokens and
            any user-level identifiers; we keep aggregated metrics only for the
            period permitted by the underlying agency contract.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            Option 2 — Email request (for business records)
          </h2>
          <p>
            Email{" "}
            <a
              href="mailto:privacy@polarad.co.kr"
              className="text-blue-600 hover:underline"
            >
              privacy@polarad.co.kr
            </a>{" "}
            from the address on file with the following:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Client / business name</li>
            <li>Facebook Ad Account ID(s) and Page ID(s) you want removed</li>
            <li>Reason (optional)</li>
          </ul>
          <p>
            We confirm receipt within 2 business days and complete the deletion
            within 30 days. We will send a written confirmation when the
            deletion has finished.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">What gets deleted</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>OAuth access tokens and refresh tokens</li>
            <li>
              User-level identifiers (Facebook user ID, Page Access Token
              mapping)
            </li>
            <li>Ad account ↔ client mapping rows</li>
            <li>Cached campaign / page metrics tied to the deleted assets</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            What we may retain
          </h2>
          <p>
            We may retain aggregated, de-identified performance numbers for the
            duration of the original advertising service agreement, as required
            for our own accounting and tax records under Korean law (commonly 5
            years). These retained numbers cannot be linked back to a Facebook
            user or Page.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">Status check</h2>
          <p>
            For a status check on an in-progress deletion request, reply to the
            confirmation email or contact{" "}
            <a
              href="mailto:privacy@polarad.co.kr"
              className="text-blue-600 hover:underline"
            >
              privacy@polarad.co.kr
            </a>
            .
          </p>

          <hr className="my-12 border-neutral-200" />

          <h2 className="text-xl font-semibold mb-3 text-neutral-700">
            한국어 요약
          </h2>
          <ol className="list-decimal pl-6 space-y-2 text-sm text-neutral-600">
            <li>
              자동 삭제: Facebook 설정 → 비즈니스 통합에서 POLA-REPORT를
              제거하면 Meta가 서버 콜백을 호출하여 토큰·사용자 식별자가 즉시
              삭제됩니다.
            </li>
            <li>
              이메일 요청: privacy@polarad.co.kr 로 클라이언트명, 광고계정 ID,
              Page ID와 함께 요청하면 영업일 2일 내 접수 확인, 30일 내 삭제 완료
              후 회신합니다.
            </li>
            <li>
              회계·세무 기록을 위해 익명화된 집계 성과 수치는 한국 법령에 따라
              일정 기간 보관할 수 있습니다.
            </li>
          </ol>
        </article>
      </main>

      <footer className="py-6 text-center text-xs text-neutral-400">
        &copy; 2026 Polarad. All rights reserved.
      </footer>
    </div>
  );
}
