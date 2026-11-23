import { StartForm } from "./StartForm";

export const metadata = { title: "Borrower form · Before the Bell" };

export default function ApplyPage() {
  return (
    <div className="apply-start">
      <div className="apply-intro">
        <h1>Raise secured funding from larger NBFCs</h1>
        <p className="lede">
          Tell us about your NBFC once. Start with a few details here; the full form follows, and you can fill it in over as many sittings
          as you need.
        </p>
        <h2 className="flow-title">What happens next</h2>
        <ol className="flow">
          <li>
            <strong>You fill in what you have</strong>
            <span>Only a handful of answers are needed to send it. Anything else can follow, and our team can walk through it with you.</span>
          </li>
          <li>
            <strong>Our team reviews it</strong>
            <span>The form and your documents are seen only by the Before the Bell team at this stage. If something is missing, we&apos;ll ask.</span>
          </li>
          <li>
            <strong>We match it to lenders</strong>
            <span>Where it fits, the raise goes only to lenders whose thesis, rate band and risk appetite match.</span>
          </li>
          <li>
            <strong>Lenders run their diligence</strong>
            <span>Each matched lender works from the same files, so you upload them once.</span>
          </li>
        </ol>
      </div>
      <section className="start-card" aria-labelledby="start-h">
        <h2 id="start-h">Start your form</h2>
        <p className="muted small">This also sets up your sign-in, so you can come back to the form any time with your email.</p>
        <StartForm />
      </section>
    </div>
  );
}
