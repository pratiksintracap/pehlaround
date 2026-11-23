import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { PRIVACY_NOTICE_VERSION } from "@/lib/credit/brand";
import { GRIEVANCE } from "@/lib/site";
import { CreditShell } from "@/components/credit/CreditBits";

export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/privacy`, title: "Private credit privacy notice",
  description: "How SintraCap Advisors LLP handles personal data in Before the Bell's private-credit desk, under the Digital Personal Data Protection Act, 2023." });

/*
 * Notice under the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025, for the private-credit desk (borrower
 * form, lender and admin console). Borrowers consent to this version (PRIVACY_NOTICE_VERSION) when they start the form.
 */
export default function PrivacyNotice() {
  const contact = <>{GRIEVANCE.name}, SintraCap Advisors LLP, 3501-B World View, World Towers, Lower Parel, Mumbai. Email: <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a></>;
  return (
    <CreditShell here="/privacy">
      <header className="cr-hero slim"><div className="wrap"><h1>Privacy notice</h1><p className="cr-lede">Private credit desk. Version {PRIVACY_NOTICE_VERSION}.</p></div></header>
      <div className="wrap cr-article">
      <p>
        Before the Bell is operated by SintraCap Advisors LLP (&quot;we&quot;, &quot;us&quot;), 3501-B World View, World Towers, Lower Parel, Mumbai. We are the data fiduciary for
        the personal data described here under India&apos;s Digital Personal Data Protection Act, 2023 (the &quot;DPDP Act&quot;) and the rules
        made under it. This notice explains what personal data we process, why, and how you can exercise your rights.
      </p>

      <h2>What we collect and why</h2>
      <table>
        <thead>
          <tr><th>When</th><th>Personal data</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>You request access or start the borrower form on this website</td>
            <td>Your name, your company&apos;s name, work email, phone number (optional) and anything you write in the message</td>
            <td>To respond to your request, check that you represent the company, and set up your access</td>
          </tr>
          <tr>
            <td>You have an account on the private-credit console</td>
            <td>Name, work email, organisation, role, sign-in records (time, IP address, browser), and, where used, authenticator set-up data</td>
            <td>To sign you in securely, control what you can see, protect the platform, and keep a record of changes</td>
          </tr>
          <tr>
            <td>You use the console</td>
            <td>Messages you send in deal threads, and actions you take (for example, indicating interest)</td>
            <td>To run the funding process you are part of and keep an audit trail</td>
          </tr>
          <tr>
            <td>A borrowing company shares diligence documents</td>
            <td>Documents may include personal data of the company&apos;s directors, promoters, signatories or customers</td>
            <td>To screen the company and share its diligence only with lenders on that company&apos;s raises, under our agreement with that company</td>
          </tr>
        </tbody>
      </table>
      <p>
        We process personal data with your consent, or where the DPDP Act otherwise permits it, such as data you give us voluntarily for a
        stated purpose. We do not sell personal data or use it for advertising. The private-credit console uses only the cookies needed to keep
        you signed in.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>Participants on the same deal, only as needed for that deal. Lenders never see other lenders&apos; details.</li>
        <li>Service providers who host the platform and send email for us, acting on our instructions under contract.</li>
        <li>Authorities, where the law requires us to.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep personal data only as long as the purpose needs it, then erase it, unless a law requires us to keep it longer. Access requests
        are erased once dealt with or when you withdraw consent. Account records and logs are kept for at least one year, as the DPDP rules
        require, and longer where other laws that apply to financial transactions require it. Where the rules require it, we will tell you
        before erasing your data.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Withdraw consent</strong> at any time, as easily as you gave it, by writing to the contact below. Withdrawal doesn&apos;t affect processing done before it. Without the data, we may be unable to give you access.</li>
        <li><strong>Get a summary</strong> of the personal data we process about you and who we have shared it with.</li>
        <li><strong>Correct, complete, update or erase</strong> your personal data.</li>
        <li><strong>Raise a grievance</strong> with us, and we will respond within 90 days.</li>
        <li><strong>Nominate</strong> someone to exercise your rights if you die or become unable to.</li>
      </ul>
      <p>
        To exercise any right, contact: {contact}. If you are not satisfied with our response, you can complain to the Data Protection Board of
        India.
      </p>

      <h2>How we protect it</h2>
      <p>
        Accounts are by invitation and every sign-in needs a one-time code sent to your work email. Data is encrypted in transit, access is
        limited by role and by deal, and changes are recorded in an audit log. If a personal data breach occurs, we will inform you and the
        Data Protection Board as the law requires.
      </p>

      <h2>Children</h2>
      <p>Before the Bell is for businesses and is not meant for anyone under 18. We do not knowingly collect children&apos;s personal data.</p>

      <h2>Changes to this notice</h2>
      <p>
        If we change this notice we will update the version above and, where the change affects how we use data you gave us, ask for your
        consent again.
      </p>

      <h2>Contact</h2>
        <p>{contact}</p>
      </div>
    </CreditShell>
  );
}
