import Link from "next/link";

export const metadata = {
  title: "Terms of Service — POLA-REPORT",
  description:
    "Terms of service for POLA-REPORT, the Polarad agency reporting platform.",
};

export default function TermsPage() {
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
            <Link href="/data-deletion" className="hover:text-neutral-900">
              Data Deletion
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <article className="prose prose-neutral max-w-none">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-neutral-500">Last updated: May 16, 2026</p>

          <h2 className="text-xl font-semibold mt-8 mb-3">1. Service</h2>
          <p>
            POLA-REPORT is an internal reporting application provided by{" "}
            <strong>Polarad</strong> (&ldquo;the Agency&rdquo;) to clients who
            have executed a digital advertising service agreement with Polarad.
            Access is restricted to (a) approved Polarad operators, and (b)
            authorized representatives of contracted clients viewing their own
            reports.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">2. Eligible users</h2>
          <p>
            You may only use POLA-REPORT if you are an active Polarad operator
            or an authorized point of contact for a client whose contract is
            currently in effect. Account sharing, scraping, and automated access
            outside the agreed APIs is prohibited.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            3. Meta integration
          </h2>
          <p>
            POLA-REPORT integrates with Meta&apos;s Marketing API only after the
            client grants Polarad the required Business Manager and Page
            permissions. The client retains full ownership and control of their
            Meta assets and may revoke the Agency&apos;s access at any time
            through Meta Business Settings.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            4. Use restrictions
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Do not attempt to access another client&apos;s data</li>
            <li>Do not redistribute reports outside the agreed scope</li>
            <li>Do not reverse-engineer or circumvent authentication</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            5. Limitation of liability
          </h2>
          <p>
            POLA-REPORT is provided on an &ldquo;as is&rdquo; basis. Reporting
            metrics are derived from Meta&apos;s Marketing API and reflect
            Meta&apos;s reported numbers at the time of fetch. Polarad is not
            liable for any indirect damages arising from reliance on these
            metrics.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">6. Termination</h2>
          <p>
            Access is automatically terminated when the underlying service
            agreement ends, or when the client revokes Meta permissions. Upon
            termination, see{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy &sect; 5
            </Link>{" "}
            for data retention details.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">7. Governing law</h2>
          <p>
            These terms are governed by the laws of the Republic of Korea. Any
            dispute shall be resolved before the Seoul Central District Court.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">8. Contact</h2>
          <p>
            Questions:{" "}
            <a
              href="mailto:hello@polarad.co.kr"
              className="text-blue-600 hover:underline"
            >
              hello@polarad.co.kr
            </a>
          </p>

          <hr className="my-12 border-neutral-200" />

          <h2 className="text-xl font-semibold mb-3 text-neutral-700">
            한국어 요약
          </h2>
          <p className="text-sm text-neutral-600">
            POLA-REPORT는 폴라애드와 광고대행 계약을 체결한 광고주, 그리고
            승인된 폴라애드 운영자만 사용할 수 있는 내부 리포팅 도구입니다.
            광고주가 비즈니스 매니저에서 부여한 Meta 권한 범위 안에서만 데이터를
            조회하며, 광고주는 언제든지 권한을 회수할 수 있습니다. 본 약관은
            대한민국 법률에 따르며 분쟁은 서울중앙지방법원을 관할로 합니다.
          </p>
        </article>
      </main>

      <footer className="py-6 text-center text-xs text-neutral-400">
        &copy; 2026 Polarad. All rights reserved.
      </footer>
    </div>
  );
}
