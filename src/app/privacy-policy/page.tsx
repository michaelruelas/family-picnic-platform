import type { Metadata } from 'next';
import Link from 'next/link';
import { BreatheSection } from '~/components/ui/BreatheSection';

export const metadata: Metadata = {
  title: 'Privacy Policy | Folia Picnic',
  description: 'Privacy Policy for the Folia Picnic platform.',
};

export default function PrivacyPolicyPage() {
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
          Privacy Notice
        </p>
        <h1 className="font-display text-foreground mt-2 text-4xl font-medium tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">Last updated: August 16, 2026</p>
      </BreatheSection>

      <article className="text-foreground/90 mt-10 space-y-10">
        <section className="space-y-3">
          <p>
            This Privacy Policy describes how Folia Picnic collects, uses, and shares your data when
            you use https://foliapicnic.com. By using the Service, you agree to the collection and
            use of data under this Privacy Policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            1. Definitions
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Account:</strong> A unique account created for you to access the Service.
            </li>
            <li>
              <strong>Company (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;):</strong> Folia
              Picnic.
            </li>
            <li>
              <strong>Cookies:</strong> Small text files placed on your device to remember
              preferences and track site visits.
            </li>
            <li>
              <strong>Device:</strong> Any computer, phone, or tablet that accesses the Service.
            </li>
            <li>
              <strong>Personal Data:</strong> Any data that identifies or relates to an identifiable
              individual.
            </li>
            <li>
              <strong>Service:</strong> The Folia Picnic website at https://foliapicnic.com.
            </li>
            <li>
              <strong>Service Provider:</strong> A third-party vendor that processes data on our
              behalf.
            </li>
            <li>
              <strong>Usage Data:</strong> Data collected automatically when you use the Service.
            </li>
            <li>
              <strong>You:</strong> The individual or household member using the Service.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            2. Information We Collect
          </h2>
          <h3 className="font-display text-foreground text-lg font-medium">
            A. Personal Data You Provide
          </h3>
          <p>
            We collect personal data that you provide when you register, RSVP, or manage households:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Name and contact details (first name, last name, email address, phone number, mailing
              address).
            </li>
            <li>Household and member details (names, relationships, dietary notes, allergies).</li>
            <li>Event details (RSVP responses, potluck signups, comments).</li>
            <li>Event photos you upload to shared albums.</li>
            <li>
              Billing information (name and zip code. Payment processors collect card numbers
              directly).
            </li>
          </ul>

          <h3 className="font-display text-foreground pt-2 text-lg font-medium">
            B. Usage Data Collected Automatically
          </h3>
          <p>We collect usage data automatically when you browse the Service:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Internet Protocol (IP) address.</li>
            <li>Browser type and browser version.</li>
            <li>Device type, operating system, and unique device identifiers.</li>
            <li>Pages visited, time spent on pages, and visit timestamps.</li>
          </ul>

          <h3 className="font-display text-foreground pt-2 text-lg font-medium">
            C. Cookies and Tracking Technologies
          </h3>
          <p>We use cookies to maintain your session and improve the Service:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Essential Cookies:</strong> Keep you signed in and protect your account
              security.
            </li>
            <li>
              <strong>Preference Cookies:</strong> Remember your settings, event filters, and
              display options.
            </li>
            <li>
              <strong>Analytics Cookies:</strong> Track general site performance and feature usage.
            </li>
          </ul>
          <p>
            You can set your browser to refuse cookies. If you disable cookies, some features of the
            Service will not function properly.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            3. How We Use Your Data
          </h2>
          <p>We use your data for the following purposes:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide, maintain, and improve the Service.</li>
            <li>Manage your account registration and profile.</li>
            <li>Coordinate event RSVPs, potluck items, and family household groups.</li>
            <li>Process event fees and ticket payments through our payment processors.</li>
            <li>Send event updates, RSVP confirmations, and SMS alerts if you opt in.</li>
            <li>Respond to customer support requests and questions.</li>
            <li>Protect against fraud, abuse, and security threats.</li>
            <li>Comply with legal obligations.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            4. Sharing Your Data
          </h2>
          <p>We do not sell your personal data. We share data only in the following cases:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Event Members:</strong> Other invited guests in your event can view your RSVP,
              potluck items, and shared photos.
            </li>
            <li>
              <strong>Service Providers:</strong> We share data with vendors that help operate our
              Service (cloud hosting, payment processing, SMS/email delivery).
            </li>
            <li>
              <strong>Payment Processing:</strong> Payment processors handle payment card details
              under PCI-DSS standards. We never store credit card numbers on our servers.
            </li>
            <li>
              <strong>Business Transfers:</strong> If Folia Picnic merges or sells assets, your data
              may transfer to the new owner.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We disclose data if required by law, court order,
              or government authority.
            </li>
            <li>
              <strong>With Your Consent:</strong> We share data with third parties if you give clear
              consent.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            5. Data Retention and Security
          </h2>
          <p>
            We keep your personal data only as long as needed to provide the Service and satisfy
            legal duties. We keep usage data for internal analysis and security auditing.
          </p>
          <p>
            We use industry-standard technical safeguards to protect your data. No transmission over
            the internet is completely secure. We cannot guarantee absolute security of your data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            6. Your Rights Under GDPR (European Union Users)
          </h2>
          <p>If you reside in the European Economic Area (EEA), you have the following rights:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Access:</strong> Request a copy of the personal data we hold about you.
            </li>
            <li>
              <strong>Correction:</strong> Request correction of inaccurate or incomplete data.
            </li>
            <li>
              <strong>Erasure:</strong> Request deletion of your personal data when we no longer
              need it.
            </li>
            <li>
              <strong>Objection:</strong> Object to our processing of your data based on legitimate
              interests.
            </li>
            <li>
              <strong>Restriction:</strong> Request restriction of processing under certain legal
              conditions.
            </li>
            <li>
              <strong>Data Portability:</strong> Receive your data in a structured, machine-readable
              format.
            </li>
            <li>
              <strong>Withdraw Consent:</strong> Withdraw consent at any time if processing relies
              on consent.
            </li>
          </ul>
          <p>
            To exercise your GDPR rights, email privacy@foliapicnic.com. You have the right to lodge
            a complaint with your local data protection authority.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            7. Notice for California Residents (CCPA / CPRA)
          </h2>
          <p>
            Under the California Consumer Privacy Act (CCPA), California residents have specific
            privacy rights:
          </p>
          <h3 className="font-display text-foreground pt-2 text-lg font-medium">
            Categories Collected in the Last 12 Months:
          </h3>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Identifiers:</strong> Name, email address, phone number, IP address, account
              name.
            </li>
            <li>
              <strong>Customer Records:</strong> Contact details, household relationships, dietary
              notes.
            </li>
            <li>
              <strong>Commercial Information:</strong> Event registrations and payment records.
            </li>
            <li>
              <strong>Internet Activity:</strong> Browser interactions, device data, and page
              history.
            </li>
            <li>
              <strong>Sensory Data:</strong> Photos you upload to event albums.
            </li>
          </ul>
          <h3 className="font-display text-foreground pt-2 text-lg font-medium">
            Your California Rights:
          </h3>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Right to Know:</strong> Request the categories and specific pieces of personal
              data we collected about you.
            </li>
            <li>
              <strong>Right to Delete:</strong> Request deletion of your personal data, subject to
              legal exceptions.
            </li>
            <li>
              <strong>Right to Correct:</strong> Request correction of inaccurate personal data.
            </li>
            <li>
              <strong>Right to Opt-Out of Sale or Sharing:</strong> We do not sell or share personal
              data for cross-context behavioral advertising.
            </li>
            <li>
              <strong>Right to Non-Discrimination:</strong> We will not discriminate against you for
              exercising your privacy rights.
            </li>
          </ul>
          <p>
            To submit a request, contact privacy@foliapicnic.com. We will verify your identity
            before processing your request.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            8. Children&apos;s Privacy
          </h2>
          <p>
            We do not knowingly collect personal data directly from children under 13. Parents or
            legal guardians may add household member names and ages to household profiles. If a
            child under 13 provided personal data without parental consent, contact
            privacy@foliapicnic.com. We will delete that data promptly.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            9. Do Not Track Signals (CalOPPA)
          </h2>
          <p>
            Our Service does not respond to Do Not Track (DNT) browser signals. You can manage
            tracking settings directly in your web browser.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            10. Links to Third-Party Sites
          </h2>
          <p>
            Our Service may link to external websites that we do not operate. We have no control
            over the content or privacy practices of external sites. Review the privacy policy of
            any external website you visit.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            11. Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated policy on
            this page and update the &quot;Last updated&quot; date.
          </p>
          <p>
            For material changes, we will notify you by email or through a notice on the Service.
            Review this page periodically for updates.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            12. Contact Us
          </h2>
          <p>If you have questions about this Privacy Policy, contact us:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Email:{' '}
              <a
                href="mailto:privacy@foliapicnic.com"
                className="text-terracotta hover:text-terracotta/80 underline"
              >
                privacy@foliapicnic.com
              </a>
            </li>
            <li>Website: https://foliapicnic.com/contact</li>
            <li>Mailing Address: Folia Picnic, United States</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
