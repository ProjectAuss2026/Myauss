export const PRIVACY_POLICY_VERSION = "2026-08-18";

export function Privacy() {
  return (
    <div className="min-h-screen bg-black">
      <article className="max-w-[820px] mx-auto px-6 py-16 md:py-24 text-white/70">
        <header className="mb-12">
          <p
            className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 500 }}
          >
            Member information
          </p>
          <h1
            className="text-white mb-4"
            style={{
              fontSize: "clamp(36px, 5vw, 55px)",
              fontWeight: 500,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Privacy Policy
          </h1>
          <p
            className="text-white/40 text-sm"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Version {PRIVACY_POLICY_VERSION}
          </p>
        </header>

        <div
          className="space-y-6 leading-relaxed"
          style={{ fontSize: "16px", fontFamily: "Inter, sans-serif" }}
        >
          <section aria-labelledby="information-collected">
            <h2
              id="information-collected"
              className="text-white text-xl font-semibold mb-3"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Information we collect
            </h2>
            <p>
              We collect personal information from you, including information
              about your:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1 marker:text-[#eb7524]">
              <li>Name</li>
              <li>Email address</li>
              <li>Student ID number</li>
            </ul>
          </section>

          <section aria-labelledby="collection-purpose">
            <h2
              id="collection-purpose"
              className="text-white text-xl font-semibold mb-3"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Why we collect it
            </h2>
            <p>We collect your personal information in order to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1 marker:text-[#eb7524]">
              <li>Identify you as a member of the Society</li>
              <li>Register your event attendance</li>
            </ul>
          </section>

          <p>
            Third parties, such as Stripe, may collect your banking or payment
            information in order to process payments through our website. We do
            not retain this information.
          </p>

          <section aria-labelledby="information-sharing">
            <h2
              id="information-sharing"
              className="text-white text-xl font-semibold mb-3"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Information sharing
            </h2>
            <p>
              Besides our executive team, we share certain information with the
              University of Auckland to comply with their club registration
              requirements:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1 marker:text-[#eb7524]">
              <li>Name</li>
              <li>Student ID number</li>
            </ul>
          </section>

          <section aria-labelledby="information-retention">
            <h2
              id="information-retention"
              className="text-white text-xl font-semibold mb-3"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Information retention
            </h2>
            <div className="space-y-4">
              <p>
                We keep your account data for up to 15 months, after which we
                securely destroy it by deleting it.
              </p>
              <p>
                We retain certain information for up to 7 years to comply with
                our legal obligations under the Incorporated Societies Act 2022.
                This includes your name, contact information, and the dates at
                which your membership commenced and ceased.
              </p>
            </div>
          </section>

          <section aria-labelledby="privacy-rights">
            <h2
              id="privacy-rights"
              className="text-white text-xl font-semibold mb-3"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Your rights
            </h2>
            <p>
              You have the right to ask for a copy of any personal information
              we hold about you, and to ask for it to be corrected if you think
              it is wrong. If you’d like to request a copy of your information or
              have it corrected, please contact us at{" "}
              <a
                href="mailto:uoastrengthsociety@gmail.com"
                className="text-[#eb7524] underline underline-offset-2 hover:text-[#f08b48]"
              >
                uoastrengthsociety@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
