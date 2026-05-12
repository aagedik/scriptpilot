import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "ScriptPilot",
      url: "https://app.w103.com/",
      applicationCategory: "MarketingApplication",
      operatingSystem: "Shopify",
      description:
        "ScriptPilot is the Shopify tracking scripts manager that deploys Meta Pixel, Google Analytics, Google Tag Manager, TikTok Pixel, Pinterest Tag, Snapchat Pixel, and verification tags without editing theme files.",
      featureList: [
        "Install Meta Pixel, Google Analytics, Google Tag Manager, TikTok Pixel, Pinterest Tag, Snapchat Pixel, and verification tags on Shopify.",
        "Deploy scripts through a Shopify Theme App Extension with automatic clean uninstall.",
        "Add tracking and verification codes without touching Liquid or theme files."
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock"
      },
      creator: {
        "@type": "Organization",
        name: "ScriptPilot"
      }
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I add the Meta Pixel to Shopify without editing theme files?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Install ScriptPilot on Shopify, enter your Meta Pixel ID, and ScriptPilot injects the pixel through a Theme App Extension—no Liquid or theme editing required."
          }
        },
        {
          "@type": "Question",
          name: "Can I install Google Analytics on Shopify with ScriptPilot?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Yes. ScriptPilot connects Google Analytics, Google Tag Manager, and other analytics scripts in minutes and keeps them lightweight for high performance."
          }
        },
        {
          "@type": "Question",
          name: "Does ScriptPilot support TikTok Pixel and verification tags?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "ScriptPilot manages TikTok Pixel, Pinterest Tag, Snapchat Pixel, and custom verification tags with automated load control and clean uninstall."
          }
        }
      ]
    },
    {
      "@type": "Organization",
      name: "ScriptPilot",
      url: "https://app.w103.com/",
      contactPoint: [
        {
          "@type": "ContactPoint",
          email: "support@scriptpilot.app",
          contactType: "customer support"
        }
      ]
    }
  ]
};

const structuredDataScript = JSON.stringify(structuredData);

const platformItems = [
  "Meta Pixel",
  "Google Analytics",
  "Google Tag Manager",
  "TikTok Pixel",
  "Pinterest Tag",
  "Snapchat Pixel",
  "Custom tracking scripts",
  "Verification tags"
];

const faqItems = [
  {
    question: "How do I add the Meta Pixel to Shopify without editing theme files?",
    answer:
      "ScriptPilot installs inside your admin. Enter your Meta Pixel ID and we publish it through a Shopify Theme App Extension—no Liquid edits or developer access required."
  },
  {
    question: "Can I install Google Analytics on Shopify with ScriptPilot?",
    answer:
      "Yes. ScriptPilot connects Google Analytics, Google Tag Manager, and Google Ads conversion tags while keeping them isolated from your theme for fast page loads."
  },
  {
    question: "Does ScriptPilot support TikTok Pixel and other social pixels?",
    answer:
      "Absolutely. Add TikTok Pixel, Pinterest Tag, Snapchat Pixel, and any custom script or verification code from one dashboard."
  },
  {
    question: "What happens when I uninstall the app?",
    answer:
      "ScriptPilot cleans up every installed script automatically so your theme stays pristine and compliant."
  },
  {
    question: "Is ScriptPilot GDPR compliant?",
    answer:
      "We never store customer data. Scripts are deployed via Shopify infrastructure with clean uninstall, making ScriptPilot GDPR-friendly by design."
  }
];

export const meta = () => {
  const title = "ScriptPilot | Shopify Tracking Scripts & Pixel Manager";
  const description =
    "ScriptPilot helps Shopify merchants install Meta Pixel, Google Analytics, Google Tag Manager, TikTok Pixel, and verification tags without editing theme files.";
  const url = "https://app.w103.com/";

  return [
    { title },
    { name: "description", content: description },
    {
      name: "keywords",
      content:
        "Shopify tracking scripts app, how to add Meta Pixel to Shopify, install Google Analytics on Shopify, Shopify Theme App Extension tracking"
    },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { tagName: "link", rel: "canonical", href: url }
  ];
};

export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;600&display=swap"
  }
];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const embedded = url.searchParams.get("embedded");
  const host = url.searchParams.get("host");
  const shop = url.searchParams.get("shop");

  console.info("[route-debug][index-loader]", {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    embedded,
    host,
    shop,
    willRedirectToApp: Boolean(embedded === "1" || host),
  });

  if (embedded === "1" || host) {
    const redirectUrl = `/app${url.search}`;
    console.info("[route-debug][index-redirect]", {
      redirectUrl,
      reason: embedded === "1" ? "embedded=1 detected" : "host param detected",
    });
    return redirect(redirectUrl);
  }

  return json({ showForm: Boolean(login) });
};

export default function LandingPage() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: structuredDataScript }}
      />
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerInner}>
            <a href="#hero" className={styles.brand} aria-label="ScriptPilot homepage">
              ScriptPilot
            </a>
            <nav className={styles.nav} aria-label="Primary">
              <a className={styles.navLink} href="#features">
                Features
              </a>
              <a className={styles.navLink} href="#platforms">
                Integrations
              </a>
              <a className={styles.navLink} href="#trust">
                Trust
              </a>
              <a className={styles.navLink} href="#faq">
                FAQ
              </a>
              <a className={styles.navHighlight} href="/auth/login">
                Install on Shopify
              </a>
            </nav>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <section className={styles.hero} id="hero">
          <div className={`${styles.container} ${styles.heroContent}`}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Full-funnel tracking for modern Shopify brands</p>
              <h1 className={styles.heroTitle}>
                Manage every Shopify tracking script without touching Liquid.
              </h1>
              <p className={styles.heroSubtitle}>
                ScriptPilot installs Meta Pixel, Google Analytics, Google Tag Manager, TikTok Pixel, Pinterest Tag,
                Snapchat Pixel, and verification codes through a Theme App Extension. No developer, no theme edits,
                no risk.
              </p>
              <div className={styles.ctaRow}>
                {showForm ? (
                  <Form className={styles.launchForm} method="post" action="/auth/login" reloadDocument>
                    <label className={styles.formLabel} htmlFor="shop-domain">
                      Enter your Shopify domain
                    </label>
                    <div className={styles.formControls}>
                      <input
                        id="shop-domain"
                        name="shop"
                        type="text"
                        required
                        inputMode="url"
                        placeholder="your-store.myshopify.com"
                        className={styles.formInput}
                        aria-describedby="shop-help"
                      />
                      <button className={styles.primaryCta} type="submit">
                        Install on Shopify
                      </button>
                    </div>
                    <span id="shop-help" className={styles.formHint}>
                      Secure OAuth flow powered by Shopify
                    </span>
                  </Form>
                ) : (
                  <a className={styles.primaryCta} href="/auth/login">
                    Install on Shopify
                  </a>
                )}
                <a className={styles.secondaryCta} href="#features">
                  See how it works
                </a>
              </div>
              <ul className={styles.heroBenefits}>
                <li className={styles.heroBenefit}>Shopify tracking scripts app built for theme safety.</li>
                <li className={styles.heroBenefit}>Add Meta Pixel, Google Analytics, and TikTok Pixel without editing theme.</li>
                <li className={styles.heroBenefit}>Best Shopify pixel manager for growth and compliance.</li>
              </ul>
            </div>
            <div className={styles.heroPanel}>
              <div className={styles.metricCard}>
                <p className={styles.metricTitle}>Shopify native deployment</p>
                <p className={styles.metricDescription}>
                  Scripts publish via Theme App Extension blocks, so your storefront stays clean, fast, and
                  revertible.
                </p>
                <div className={styles.metricHighlights}>
                  <span>GDPR friendly</span>
                  <span>Clean uninstall</span>
                  <span>99.9% uptime</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="features">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <span className={styles.sectionEyebrow}>Problem → Solution</span>
              <h2 className={styles.sectionTitle}>No more copy-paste scripts or risky theme edits</h2>
              <p className={styles.sectionSubtitle}>
                ScriptPilot automates tracking setup so Shopify merchants can launch Meta Pixel, Google Analytics,
                Google Tag Manager, TikTok Pixel, and verification tags in minutes.
              </p>
            </div>
            <div className={styles.problemGrid}>
              <div className={styles.problemCard}>
                <h3>No theme editing required</h3>
                <p>
                  Scripts deploy as Theme App Extension blocks. Stay safe during theme updates and avoid Liquid
                  conflicts entirely.
                </p>
              </div>
              <div className={styles.problemCard}>
                <h3>Install tracking scripts safely</h3>
                <p>
                  Guided setup for each platform ensures the right pixel ID, consent mode, and script placement every
                  single time.
                </p>
              </div>
              <div className={styles.problemCard}>
                <h3>Works with Shopify Theme App Extensions</h3>
                <p>
                  Built on Shopify best practices with automatic versioning, rollback, and clean uninstall support.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.altSection}`} id="platforms">
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Supported tracking platforms</h2>
            <p className={styles.sectionSubtitle}>
              Activate these integrations without touching theme code or waiting on developers.
            </p>
            <div className={styles.platformGrid}>
              {platformItems.map((item) => (
                <div key={item} className={styles.platformItem}>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} id="trust">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <span className={styles.sectionEyebrow}>Merchant trust</span>
              <h2 className={styles.sectionTitle}>Built for compliance, uninstall safety, and storefront speed</h2>
              <p className={styles.sectionSubtitle}>
                ScriptPilot keeps your Shopify store trustworthy with shop-ready policies and transparent data
                handling.
              </p>
            </div>
            <div className={styles.trustGrid}>
              <div className={styles.trustCard}>
                <h3>What merchants get</h3>
                <ul className={styles.badgeList}>
                  <li>GDPR compliant deployment</li>
                  <li>Clean uninstall automation</li>
                  <li>No coding required</li>
                  <li>Shopify-compatible architecture</li>
                  <li>Dedicated support at support@scriptpilot.app</li>
                </ul>
              </div>
              <div className={styles.trustCard}>
                <h3>How ScriptPilot works</h3>
                <ul className={styles.badgeList}>
                  <li>Theme App Extension publishes and removes blocks safely</li>
                  <li>Server-side verification for Shopify OAuth and webhooks</li>
                  <li>Realtime audit log of script changes</li>
                  <li>Consent-aware loading patterns</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.altSection}`} id="performance">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <span className={styles.sectionEyebrow}>Performance</span>
              <h2 className={styles.sectionTitle}>Lightweight script injection that respects Core Web Vitals</h2>
              <p className={styles.sectionSubtitle}>
                ScriptPilot optimizes load order, defers non-critical scripts, and isolates pixels from your theme so
                your storefront stays fast.
              </p>
            </div>
            <div className={styles.performanceGrid}>
              <div className={styles.performanceCard}>
                <h3>Safe script sandbox</h3>
                <p>
                  Scripts run in isolated extension containers with scoped CSS and deferred execution for faster first
                  paint.
                </p>
              </div>
              <div className={styles.performanceCard}>
                <h3>Automatic duplication prevention</h3>
                <p>
                  ScriptPilot detects existing pixels so you never double-load Meta Pixel, Google Analytics, or GTM.
                </p>
              </div>
              <div className={styles.performanceCard}>
                <h3>Compliance-ready audit trail</h3>
                <p>
                  Every script install, update, and removal is logged to help your marketing and compliance teams stay
                  aligned.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="faq">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <span className={styles.sectionEyebrow}>FAQ</span>
              <h2 className={styles.sectionTitle}>Answers to top Shopify tracking questions</h2>
              <p className={styles.sectionSubtitle}>
                Straightforward guidance for merchants searching how to install Meta Pixel, Google Analytics, and other
                scripts the safe way.
              </p>
            </div>
            <div className={styles.faqList}>
              {faqItems.map((item) => (
                <div key={item.question} className={styles.faqItem}>
                  <h3 className={styles.faqQuestion}>{item.question}</h3>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.finalCta}`} id="contact">
          <div className={styles.container}>
            <div className={styles.finalInner}>
              <h2 className={styles.finalTitle}>Start using ScriptPilot today</h2>
              <p className={styles.finalSubtitle}>
                Launch best-in-class Shopify tracking scripts in minutes. Zero theme edits, zero surprises, full
                marketing visibility.
              </p>
              <div className={styles.finalActions}>
                <a className={styles.primaryCta} href="/auth/login">
                  Install on Shopify
                </a>
                <a className={styles.secondaryCta} href="mailto:support@scriptpilot.app">
                  Contact support
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerInner}>
            <p>© {new Date().getFullYear()} ScriptPilot. All rights reserved.</p>
            <div className={styles.footerLinks}>
              <a href="mailto:support@scriptpilot.app">support@scriptpilot.app</a>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <a href="#faq">FAQ</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
