import { useEffect, useState } from "react";

const LOG = "[auth-debug]";
const EMBED_LOG = "[embed-debug]";

function waitForShopifyGlobal(timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if (window.shopify) {
      resolve(window.shopify);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.shopify) {
        clearInterval(interval);
        resolve(window.shopify);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 50);
  });
}

export default function AppBridgeDiagnostics({ apiKey, host, shop }) {
  const [status, setStatus] = useState("waiting");

  useEffect(() => {
    let cancelled = false;

    const inIframe = typeof window !== "undefined" ? window.top !== window.self : null;
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const embeddedParam = urlParams?.get("embedded");
    const hostParam = urlParams?.get("host");

    console.info(`${EMBED_LOG}[iframe-status]`, {
      inIframe,
      topEqualsSelf: typeof window !== "undefined" ? window.top === window.self : null,
      embeddedParam,
      hostParamPresent: Boolean(hostParam),
      routeCategory: inIframe ? "embedded" : "standalone",
    });

    if (!inIframe && embeddedParam === "1") {
      console.error(`${EMBED_LOG}[breakout-detected]`, {
        message: "App is NOT inside iframe but embedded=1 is present. iframe breakout occurred.",
        currentUrl: window.location.href,
      });
    }

    console.info(`${LOG}[mount]`, {
      apiKeyPresent: Boolean(apiKey),
      hostPresent: Boolean(host),
      shop,
      url: typeof window !== "undefined" ? window.location.href : null,
      inIframe,
    });

    (async () => {
      const shopify = await waitForShopifyGlobal();
      if (cancelled) return;

      if (!shopify) {
        console.error(`${LOG}[app-bridge]`, {
          status: "global_not_found",
          message: "window.shopify never appeared. App Bridge CDN script likely failed to load.",
        });
        setStatus("missing");
        return;
      }

      console.info(`${LOG}[app-bridge]`, {
        status: "initialized",
        hasIdToken: typeof shopify.idToken === "function",
        hasConfig: Boolean(shopify.config),
        configHost: shopify.config?.host ?? null,
        configShop: shopify.config?.shop ?? null,
        configApiKey: shopify.config?.apiKey ? `${shopify.config.apiKey.slice(0, 6)}***` : null,
      });

      try {
        const token = typeof shopify.idToken === "function" ? await shopify.idToken() : null;
        console.info(`${LOG}[session-token]`, {
          present: Boolean(token),
          sample: token ? `${token.slice(0, 12)}…` : null,
        });
      } catch (tokenError) {
        console.error(`${LOG}[session-token:error]`, {
          message: tokenError instanceof Error ? tokenError.message : String(tokenError),
        });
      }

      try {
        const probeUrl = "/app?__authProbe=1";
        const response = await fetch(probeUrl, { method: "GET" });
        console.info(`${LOG}[fetch-probe]`, {
          url: probeUrl,
          status: response.status,
          note:
            "App Bridge v4 CDN script auto-attaches Authorization to same-origin fetches. The server log for this URL must show hasAuthHeader:true.",
        });
      } catch (probeError) {
        console.error(`${LOG}[fetch-probe:error]`, {
          message: probeError instanceof Error ? probeError.message : String(probeError),
        });
      }

      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, host, shop]);

  useEffect(() => {
    if (status === "ready") {
      console.info(`${LOG}[diagnostics]`, { status: "complete" });
    }
  }, [status]);

  return null;
}
