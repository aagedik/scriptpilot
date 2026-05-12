import { addDocumentResponseHeaders } from "../shopify.server";

const AUTH_DEBUG_PREFIX = "[auth-debug][session-token]";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopifyReload = url.searchParams.get("shopify-reload");
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const embedded = url.searchParams.get("embedded");

  console.info(`${AUTH_DEBUG_PREFIX}[loader]`, {
    url: url.toString(),
    hasShopifyReload: Boolean(shopifyReload),
    shop,
    host,
    embedded,
  });

  if (!shopifyReload) {
    console.info(`${AUTH_DEBUG_PREFIX}[loader] missing shopify-reload, redirecting to /app`);
    return new Response(null, { status: 302, headers: { Location: "/app" } });
  }

  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
  });

  addDocumentResponseHeaders(request, headers);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ScriptPilot Auth</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key="${apiKey}"></script>
</head>
<body>
  <script>
    (function() {
      const LOG = "[bounce]";
      const reloadUrl = new URL(${JSON.stringify(shopifyReload)});
      const startTime = Date.now();

      console.log(LOG, "bounce page loaded", {
        topEqualsSelf: window.top === window.self,
        inIframe: window.self !== window.top,
        reloadUrl: reloadUrl.toString(),
        shopifyGlobal: !!window.shopify,
      });

      function redirectWithToken(token) {
        reloadUrl.searchParams.set("id_token", token);
        console.log(LOG, "redirecting (iframe-safe)", {
          url: reloadUrl.toString(),
          elapsedMs: Date.now() - startTime,
        });
        window.location.replace(reloadUrl.toString());
      }

      function waitAndRetry() {
        if (Date.now() - startTime > 15000) {
          console.error(LOG, "timeout waiting for window.shopify");
          document.body.innerHTML = "<p>Authentication timeout. Please reload the app from Shopify Admin.</p>";
          return;
        }

        if (window.shopify && typeof window.shopify.idToken === "function") {
          console.log(LOG, "window.shopify ready, requesting idToken");
          window.shopify.idToken().then(redirectWithToken).catch(function(err) {
            console.error(LOG, "idToken failed", err);
            setTimeout(waitAndRetry, 100);
          });
        } else {
          setTimeout(waitAndRetry, 50);
        }
      }

      waitAndRetry();
    })();
  </script>
</body>
</html>
  `;

  return new Response(html, { headers });
};
