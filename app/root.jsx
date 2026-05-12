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
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log("[embed-debug][boot]", {
                topEqualsSelf: window.top === window.self,
                inIframe: window.self !== window.top,
                location: window.location.href,
                referrer: document.referrer || null,
                shopifyGlobal: !!window.shopify,
                appBridgeGlobal: !!window.appBridge,
                userAgent: navigator.userAgent.slice(0, 60),
              });
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
