import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const meta = () => {
  const title = "ScriptPilot Terms of Service";
  const description = "Review the ScriptPilot terms of service for using the Shopify tracking scripts manager.";
  const url = "https://app.w103.com/terms";

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
  ];
};

export const loader = () => json({ lastUpdated: "May 11, 2026" });

const pageStyle = {
  fontFamily: 'Inter, "Space Grotesk", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  background: "#f7f8ff",
  minHeight: "100vh",
  padding: "4rem 1.5rem",
  color: "#101828",
};

const containerStyle = {
  maxWidth: "820px",
  margin: "0 auto",
  background: "#ffffff",
  borderRadius: "18px",
  padding: "3rem",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "1.5rem",
};

const headingStyle = {
  fontFamily: '"Space Grotesk", Inter, sans-serif',
  fontSize: "2.4rem",
  margin: 0,
};

const subHeadingStyle = {
  fontFamily: '"Space Grotesk", Inter, sans-serif',
  fontSize: "1.35rem",
  margin: "0 0 0.6rem",
};

const paragraphStyle = {
  lineHeight: 1.7,
  margin: 0,
  fontSize: "1rem",
  color: "#334155",
};

export default function TermsOfService() {
  const { lastUpdated } = useLoaderData();

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header>
          <h1 style={headingStyle}>ScriptPilot Terms of Service</h1>
          <p style={{ ...paragraphStyle, color: "#475569" }}>Last updated: {lastUpdated}</p>
        </header>

        <section>
          <h2 style={subHeadingStyle}>1. Acceptance of terms</h2>
          <p style={paragraphStyle}>
            By installing ScriptPilot you agree to these terms, Shopify&apos;s Partner Program Agreement, and all applicable
            laws. If you do not agree, uninstall the app immediately.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>2. Service description</h2>
          <p style={paragraphStyle}>
            ScriptPilot publishes tracking scripts and verification tags through Shopify Theme App Extensions. We provide
            configuration tooling, audit logs, and uninstall cleanup to keep your theme safe.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>3. Merchant responsibilities</h2>
          <p style={paragraphStyle}>
            You are responsible for supplying accurate tracking IDs, complying with each platform&apos;s policies, and
            obtaining consent where required by law.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>4. Payment and subscriptions</h2>
          <p style={paragraphStyle}>
            ScriptPilot billing is handled through Shopify. Charges, if any, are managed by Shopify and subject to their
            billing terms. We do not store payment details.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>5. Termination</h2>
          <p style={paragraphStyle}>
            You may uninstall ScriptPilot at any time. Upon uninstall, all deployed scripts are removed automatically and
            residual configuration data is anonymized within 30 days.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>6. Support</h2>
          <p style={paragraphStyle}>
            Contact <a href="mailto:support@scriptpilot.app">support@scriptpilot.app</a> for help or account questions.
          </p>
        </section>
      </div>
    </main>
  );
}
