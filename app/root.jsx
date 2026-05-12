import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
export default function App() {
  return (
    <html>
      <head>
        {/* ROOT_RENDERED_OK - root.jsx is being used */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={process.env.SHOPIFY_API_KEY}
        />
        <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              const urlParams = new URLSearchParams(window.location.search);
              const embedded = urlParams.get("embedded");
              const topEqualsSelf = window.top === window.self;
              const inIframe = window.self !== window.top;
              
              console.log("[embed-debug][boot]", {
                topEqualsSelf: topEqualsSelf,
                inIframe: inIframe,
                location: window.location.href,
                referrer: document.referrer || null,
                shopifyGlobal: !!window.shopify,
                appBridgeGlobal: !!window.appBridge,
                embedded: embedded,
                userAgent: navigator.userAgent.slice(0, 60),
              });

              console.log("[bridge-debug]", {
                shopifyGlobal: !!window.shopify,
                appBridgeGlobal: !!window.appBridge,
                topEqualsSelf: window.top === window.self,
                scripts: [...document.scripts].map(s => s.src).filter(Boolean),
                shopifyApiKeyMeta: document.querySelector('meta[name="shopify-api-key"]')?.content || null,
              });

              if (embedded === "1" && topEqualsSelf) {
                console.error("[embed-debug][CRITICAL-BREAKOUT]", {
                  message: "embedded=1 present but window.top===window.self - iframe context lost at boot!",
                  currentUrl: window.location.href,
                });
              }
            `,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
