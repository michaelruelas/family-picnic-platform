import type { Metadata } from 'next';
import Link from 'next/link';
import { BreatheSection } from '~/components/ui/BreatheSection';

export const metadata: Metadata = {
  title: 'Terms of Service | Folia Picnic',
  description: 'Terms of Service for the Folia Picnic platform.',
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 md:py-20">
      <BreatheSection>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          ← Back to home
        </Link>
        <p className="text-terracotta mt-6 text-sm font-semibold tracking-widest uppercase">
          Legal Agreement
        </p>
        <h1 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight md:text-5xl">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">Last updated: August 16, 2026</p>
      </BreatheSection>

      <article className="text-foreground/90 mt-10 space-y-10">
        <section className="space-y-3">
          <p>Read these Terms of Service before you use Folia Picnic.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            1. Agreement to Terms
          </h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) form an agreement between you and Folia
            Picnic (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). These
            Terms govern your access to and use of https://foliapicnic.com (the &quot;Website&quot;
            and &quot;Service&quot;).
          </p>
          <p>
            By accessing or using the Service, you agree to these Terms. If you do not agree, do not
            use the Service. You must be at least 18 years old to use the Service. Our{' '}
            <Link
              href="/privacy-policy"
              className="text-terracotta hover:text-terracotta/80 underline"
            >
              Privacy Policy
            </Link>{' '}
            also governs your use of the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            2. Definitions
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Account:</strong> A unique profile created for you to access the Service.
            </li>
            <li>
              <strong>Content:</strong> Text, images, photos, comments, or other materials you
              submit to the Service.
            </li>
            <li>
              <strong>Device:</strong> Any computer, tablet, or phone that accesses the Service.
            </li>
            <li>
              <strong>Feedback:</strong> Suggestions, ideas, or comments you send us about the
              Service.
            </li>
            <li>
              <strong>Service:</strong> The Folia Picnic website and related event tools.
            </li>
            <li>
              <strong>You:</strong> The person or entity using the Service.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            3. User Accounts
          </h2>
          <p>
            You must provide accurate information when you create an account. Keep your account
            details current at all times. You are responsible for safeguarding your password. You
            are responsible for all activities under your account.
          </p>
          <p>
            Contact us immediately at support@foliapicnic.com if unauthorized users access your
            account. Do not use a username that impersonates another person or infringes any
            trademark.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            4. User Content
          </h2>
          <p>
            You own the Content you post on the Service. You grant Folia Picnic a worldwide,
            royalty-free license to host, display, and distribute your Content on the Service. This
            license allows invited event guests to view your Content.
          </p>
          <p>
            You confirm that you own your Content or hold the right to post it. You confirm that
            your Content does not violate any third-party rights.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            5. Content Restrictions
          </h2>
          <p>
            You agree not to post prohibited Content on the Service. Prohibited Content includes:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Unlawful, threatening, defamatory, or abusive material.</li>
            <li>Harassment or hate speech against any group or individual.</li>
            <li>Viruses, malware, trojan horses, or harmful code.</li>
            <li>Unsolicited advertisements, spam, or promotional campaigns.</li>
            <li>Material that infringes any patent, trademark, trade secret, or copyright.</li>
            <li>Impersonation of another person or entity.</li>
            <li>Private personal data of another person without consent.</li>
          </ul>
          <p>
            We reserve the right to review, edit, or remove any Content. We may suspend or delete
            accounts that post prohibited Content. We do not guarantee against data loss. Keep your
            own backup copies of your Content.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            6. Copyright Policy (DMCA)
          </h2>
          <p>
            We respect intellectual property rights. We respond to notices of alleged copyright
            infringement under the Digital Millennium Copyright Act. Send copyright notices to
            legal@foliapicnic.com.
          </p>
          <p>Your notice must include:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>A physical or electronic signature of the copyright owner or authorized agent.</li>
            <li>Identification of the copyrighted work claimed to be infringed.</li>
            <li>The URL or location of the infringing material on our Service.</li>
            <li>Your address, phone number, and email address.</li>
            <li>A statement of good faith belief that the use is unauthorized.</li>
            <li>A statement under penalty of perjury that your notice is accurate.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            7. Intellectual Property
          </h2>
          <p>
            Folia Picnic and its licensors own all rights in the Service and its original content.
            Our trademarks, logos, and brand designs belong to Folia Picnic. Do not use our
            trademarks without our written permission.
          </p>
          <p>
            If you send us Feedback, you grant us full rights to use that Feedback without payment
            or restriction.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            8. Third-Party Links
          </h2>
          <p>
            The Service may link to third-party websites or services. We do not control and do not
            endorse third-party websites. We are not liable for any content or practices of
            third-party websites. Review the terms and privacy policies of every third-party site
            you visit.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            9. Termination
          </h2>
          <p>
            We may suspend or terminate your account immediately if you breach these Terms. We may
            also terminate access for any lawful reason without advance notice.
          </p>
          <p>
            Upon termination, your right to use the Service stops immediately. You may terminate
            your account at any time by stopping your use of the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            10. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, Folia Picnic is not liable for indirect or
            consequential damages. This includes loss of profits, data, goodwill, or service
            interruption.
          </p>
          <p>
            Our total liability will not exceed what you paid us in the past 12 months, or 100 USD.
            Some jurisdictions do not allow certain liability exclusions. In those jurisdictions,
            our liability is limited to the extent permitted by law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            11. Disclaimer of Warranties
          </h2>
          <p>
            We provide the Service &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties
            of any kind. We disclaim all express, statutory, and implied warranties. These include
            implied warranties of merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
          <p>
            We do not warrant that the Service will operate without interruption or errors. We do
            not warrant that files or servers are free of viruses or malware.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            12. Governing Law and Dispute Resolution
          </h2>
          <p>
            The laws of the State of California and United States law govern these Terms. Contact us
            first at support@foliapicnic.com to resolve any dispute informally. If informal
            resolution fails within 30 days, both parties agree to resolve claims in California
            courts.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            13. General Terms
          </h2>
          <p>
            If a court finds any provision invalid, the remaining provisions stay in effect. Our
            failure to enforce any right is not a waiver of that right. You confirm that you are not
            on any United States trade sanction list.
          </p>
          <p>
            We may update these Terms from time to time. We will provide at least 30 days notice
            before material changes take effect. Using the Service after changes take effect means
            you accept the revised Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            14. Contact Us
          </h2>
          <p>If you have questions about these Terms of Service, contact us:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Email:{' '}
              <a
                href="mailto:support@foliapicnic.com"
                className="text-terracotta hover:text-terracotta/80 underline"
              >
                support@foliapicnic.com
              </a>
            </li>
            <li>Website: https://foliapicnic.com/contact</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
