export function Privacy() {
  return (
    <div className="min-h-screen bg-black">
      <article className="mx-auto max-w-[900px] px-6 py-16 md:py-24">
        <p
          className="mb-4 text-sm uppercase tracking-[0.25em] text-[#eb7524]"
          style={{ fontFamily: "Inter, sans-serif", fontWeight: 500 }}
        >
          Your information
        </p>
        <h1
          className="mb-12 text-white"
          style={{
            fontSize: "clamp(36px, 5vw, 55px)",
            fontWeight: 500,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          Privacy Policy.
        </h1>

        <div
          className="space-y-8 text-white/60"
          style={{
            fontSize: "16px",
            lineHeight: 1.8,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <section>
            <p>We collect personal information from you, including information about your:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Name</li>
              <li>Email address</li>
              <li>Student ID number</li>
            </ul>
          </section>

          <section>
            <p>We collect your personal information in order to:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Identify you as a member of the Society</li>
              <li>Register your event attendance</li>
            </ul>
          </section>

          <p>
            Third parties, such as Stripe, may collect your banking or payment
            information in order to process payments through our website. We do
            not retain this information.
          </p>

          <section>
            <p>
              Besides our executive team, we share certain information with the
              University of Auckland to comply with their club registration
              requirements:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Name</li>
              <li>Student ID number</li>
            </ul>
          </section>

          <p>
            We keep your account data for up to 15 months, after which we
            securely destroy it by deleting it.
          </p>

          <p>
            We retain certain information for up to 7 years to comply with our
            legal obligations under the Incorporated Societies Act 2022. This
            includes your name, contact information, and the dates at which your
            membership commenced and ceased.
          </p>

          <p>
            You have the right to ask for a copy of any personal information we
            hold about you, and to ask for it to be corrected if you think it is
            wrong. If you’d like to request a copy of your information or have it
            corrected, please contact us at{" "}
            <a
              className="text-[#eb7524] underline decoration-[#eb7524]/40 underline-offset-4 transition-colors hover:text-[#ff8b3d]"
              href="mailto:uoastrengthsociety@gmail.com"
            >
              uoastrengthsociety@gmail.com
            </a>
            .
          </p>
        </div>
      </article>
    </div>
  );
}
