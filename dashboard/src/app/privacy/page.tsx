import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — POLA-REPORT",
  description:
    "Privacy policy for POLA-REPORT, the Polarad agency reporting platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-neutral-900">
            POLA-REPORT
          </Link>
          <nav className="text-sm text-neutral-500 flex gap-4">
            <Link href="/terms" className="hover:text-neutral-900">
              Terms
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
            Privacy Policy
          </h1>
          <p className="text-sm text-neutral-500">Last updated: May 16, 2026</p>

          <h2 className="text-xl font-semibold mt-8 mb-3">1. Who we are</h2>
          <p>
            POLA-REPORT is an internal marketing-analytics application operated
            by <strong>Polarad</strong>, a digital advertising agency based in
            South Korea (
            <a
              href="https://polarad.co.kr"
              className="text-blue-600 hover:underline"
            >
              polarad.co.kr
            </a>
            ). POLA-REPORT is used only by authorized Polarad staff to view
            ad-performance data of clients who have contracted us to manage
            their Meta advertising.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            2. Data we collect from Meta
          </h2>
          <p>
            With the client&apos;s explicit Business Manager authorization we
            read:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Ad account identifiers, status and currency (<code>ads_read</code>
              , <code>business_management</code>)
            </li>
            <li>
              Campaign / ad-set / ad metadata and performance metrics &mdash;
              impressions, clicks, spend, reach, CTR, video views, leads (
              <code>ads_read</code>)
            </li>
            <li>
              Campaign status changes the operator initiates (
              <code>ads_management</code>, write only)
            </li>
            <li>
              Facebook Page IDs, names, categories the client manages (
              <code>pages_show_list</code>)
            </li>
            <li>
              Page-level aggregate engagement &mdash; followers, page likes,
              impressions, engaged users (<code>pages_read_engagement</code>)
            </li>
            <li>
              Basic profile information of the connecting operator &mdash; name
              and user ID (<code>public_profile</code>)
            </li>
          </ul>
          <p>
            We do <strong>not</strong> read personal messages, do{" "}
            <strong>not</strong> access individual end-user profiles, do{" "}
            <strong>not</strong> read post content beyond aggregate engagement
            counts, and do <strong>not</strong> collect payment information
            through Meta APIs.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            3. How we use the data
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Generate daily / weekly / monthly performance reports for the
              client
            </li>
            <li>
              Display the data inside the internal dashboard at
              report.polarad.co.kr
            </li>
            <li>
              Let an operator pause or activate an under-performing campaign
              directly from the dashboard
            </li>
          </ul>
          <p>We do not sell, rent or share Meta data with any third party.</p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            4. Where we store the data
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Aggregated performance metrics &mdash; Airtable (operated by
              Formagrid Inc., USA)
            </li>
            <li>
              Access tokens and ad-account identifiers &mdash; Supabase
              (operated by Supabase Inc., USA, EU&nbsp;region)
            </li>
            <li>Application hosting &mdash; Vercel Inc., USA</li>
          </ul>
          <p>
            All transmission is encrypted in transit (TLS 1.2+). Tokens are
            stored with row-level access restricted to the Polarad service role.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">5. Retention</h2>
          <p>
            Performance metrics are retained for as long as the agency contract
            with the client is active. Within 30 days of contract termination,
            or upon a verified deletion request, all data tied to that client is
            removed.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">6. Your rights</h2>
          <p>
            You may request access, correction or deletion of any data we hold
            about you or your business. See{" "}
            <Link
              href="/data-deletion"
              className="text-blue-600 hover:underline"
            >
              Data Deletion Instructions
            </Link>
            .
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">7. Contact</h2>
          <p>
            Privacy questions:{" "}
            <a
              href="mailto:privacy@polarad.co.kr"
              className="text-blue-600 hover:underline"
            >
              privacy@polarad.co.kr
            </a>
          </p>

          <hr className="my-12 border-neutral-200" />

          <h2 className="text-xl font-semibold mb-3 text-neutral-700">
            한국어 요약
          </h2>
          <p className="text-sm text-neutral-600">
            POLA-REPORT는 광고대행사 폴라애드가 운영하는 내부 분석 도구입니다.
            광고주가 비즈니스 매니저에서 권한을 부여한 광고 계정·페이지의 성과
            데이터만 읽어 리포트 생성과 캠페인 ON/OFF 운영에 사용합니다.
            데이터는 Airtable, Supabase, Vercel에 암호화 전송으로 저장하며
            제3자에게 판매·공유하지 않습니다. 계약 종료 또는 삭제 요청 시 30일
            이내 폐기합니다. 문의: privacy@polarad.co.kr
          </p>
        </article>
      </main>

      <footer className="py-6 text-center text-xs text-neutral-400">
        &copy; 2026 Polarad. All rights reserved.
      </footer>
    </div>
  );
}
