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
    fullShopifyReload: shopifyReload,
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
      const LOG = "[bounce-debug]";
      const reloadUrl = new URL(${JSON.stringify(shopifyReload)});
      const startTime = Date.now();
      const searchParams = new URLSearchParams(window.location.search);
      const embeddedParam = searchParams.get("embedded");
      const hostParam = searchParams.get("host");
      const shopParam = searchParams.get("shop");

      const reloadUrlIsAbsolute = reloadUrl.href.startsWith("http://") || reloadUrl.href.startsWith("https://");
      const reloadUrlIsStandalone = reloadUrl.hostname !== window.location.hostname;

      console.log(LOG, "bounce-page-loaded", {
        currentUrl: window.location.href,
        currentHostname: window.location.hostname,
        currentOrigin: window.location.origin,
        referrer: document.referrer || null,
        topEqualsSelf: window.top === window.self,
        inIframe: window.self !== window.top,
        reloadUrl: reloadUrl.toString(),
        reloadUrlHostname: reloadUrl.hostname,
        reloadUrlOrigin: reloadUrl.origin,
        reloadUrlIsAbsolute: reloadUrlIsAbsolute,
        reloadUrlIsStandalone: reloadUrlIsStandalone,
        reloadUrlPathname: reloadUrl.pathname,
        embeddedParam,
        hostParam,
        shopParam,
        shopifyGlobal: !!window.shopify,
        appBridgeGlobal: !!window.appBridge,
      });

      if (embeddedParam === "1" && window.top === window.self) {
        console.error(LOG, "CRITICAL-BREAKOUT-DETECTED", {
          message: "embedded=1 is present but window.top===window.self - iframe context already lost!",
          currentUrl: window.location.href,
          reloadUrl: reloadUrl.toString(),
        });
      }

      if (reloadUrlIsStandalone && embeddedParam === "1") {
        console.error(LOG, "CRITICAL-URL-MISMATCH", {
          message: "reloadUrl is standalone absolute URL but embedded=1 - this will cause iframe breakout!",
          reloadUrl: reloadUrl.toString(),
          reloadUrlHostname: reloadUrl.hostname,
          currentHostname: window.location.hostname,
        });
      }

      function redirectWithToken(token) {
        reloadUrl.searchParams.set("id_token", token);
        const finalUrl = reloadUrl.toString();

        console.log(LOG, "redirecting (iframe-safe)", {
          finalUrl,
          finalUrlHostname: reloadUrl.hostname,
          finalUrlOrigin: reloadUrl.origin,
          finalUrlPathname: reloadUrl.pathname,
          finalUrlIsAbsolute: reloadUrlIsAbsolute,
          finalUrlIsStandalone: reloadUrlIsStandalone,
          hasEmbedded: finalUrl.includes("embedded="),
          hasHost: finalUrl.includes("host="),
          hasShop: finalUrl.includes("shop="),
          elapsedMs: Date.now() - startTime,
          topEqualsSelfBeforeRedirect: window.top === window.self,
          inIframeBeforeRedirect: window.self !== window.top,
        });

        if (window.shopify && window.shopify.redirect && window.shopify.redirect.toApp) {
          console.log(LOG, "using App Bridge redirect API to preserve iframe context");
          try {
            window.shopify.redirect.toApp({
              path: reloadUrl.pathname + reloadUrl.search
            });
          } catch (err) {
            console.error(LOG, "App Bridge redirect failed, falling back to window.location.replace", err);
            window.location.replace(finalUrl);
          }
        } else {
          console.warn(LOG, "App Bridge redirect API not available, using window.location.replace (may break iframe)");
          window.location.replace(finalUrl);
        }
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
