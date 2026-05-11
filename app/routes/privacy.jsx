import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const meta = () => {
  const title = "ScriptPilot Privacy Policy";
  const description = "Learn how ScriptPilot handles merchant data, tracking scripts, and privacy obligations.";
  const url = "https://app.w103.com/privacy";

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

export default function PrivacyPolicy() {
  const { lastUpdated } = useLoaderData();

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header>
          <h1 style={headingStyle}>ScriptPilot Privacy Policy</h1>
          <p style={{ ...paragraphStyle, color: "#475569" }}>Last updated: {lastUpdated}</p>
        </header>

        <section>
          <h2 style={subHeadingStyle}>1. Data handling</h2>
          <p style={paragraphStyle}>
            ScriptPilot runs entirely inside your Shopify store. We never collect customer personal data or store
            payment information. Tracking scripts are deployed through Shopify Theme App Extensions and removed
            automatically if you uninstall the app.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>2. Shopify data usage</h2>
          <p style={paragraphStyle}>
            We request only the scopes required to publish theme app extension blocks and manage script settings. Shop
            domain, email address, and configuration settings are stored securely in our PostgreSQL database.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>3. Cookies and tracking</h2>
          <p style={paragraphStyle}>
            ScriptPilot itself does not inject additional cookies. Deployed scripts follow their respective platform
            policies (Meta, Google, TikTok, etc.). Merchants should review each vendor&apos;s requirements for consent.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>4. Data retention and deletion</h2>
          <p style={paragraphStyle}>
            On uninstall, ScriptPilot removes all published script blocks and anonymizes your shop configuration within
            30 days. You can request immediate deletion by emailing <a href="mailto:support@scriptpilot.app">support@scriptpilot.app</a>.
          </p>
        </section>

        <section>
          <h2 style={subHeadingStyle}>5. Contact</h2>
          <p style={paragraphStyle}>
            For privacy questions please contact <a href="mailto:privacy@scriptpilot.app">privacy@scriptpilot.app</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
