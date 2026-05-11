import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { useEffect, useMemo } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticatedFetch, getSessionToken } from "@shopify/app-bridge-utils";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

const AUTH_DEBUG_PREFIX = "[auth-debug][app-route]";
const serializeHeaders = (headers) => {
  if (!headers) return null;
  try {
    return Array.from(headers.entries());
  } catch (error) {
    return `unserializable: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const logAuthDebug = (stage, payload) => {
  const message = `${AUTH_DEBUG_PREFIX}[${stage}]`;
  try {
    console.info(message, JSON.stringify(payload));
  } catch (error) {
    console.info(message, payload);
  }
};

function AppBridgeDiagnostics({ apiKey, host }) {
  const app = useAppBridge();

  useEffect(() => {
    if (!app || !host) {
      console.info("[auth-debug][app-bridge]", {
        status: app ? "ready" : "not_initialized",
        host,
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await getSessionToken(app);
        if (!cancelled) {
          console.info("[auth-debug][session-token]", {
            present: Boolean(token),
            sample: token ? `${token.slice(0, 8)}…` : null,
          });
        }
      } catch (tokenError) {
        if (!cancelled) {
          console.error("[auth-debug][session-token:error]", tokenError);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [app, host]);

  useEffect(() => {
    if (!app || typeof window === "undefined") {
      return undefined;
    }

    const originalFetch = window.fetch.bind(window);
    const fetchWithAuth = authenticatedFetch(app);

    window.fetch = async (input, init) => {
      const token = await getSessionToken(app);
      const response = await fetchWithAuth(input, init);
      console.info("[auth-debug][fetch]", {
        url: typeof input === "string" ? input : input?.url,
        tokenPresent: Boolean(token),
        tokenSample: token ? `${token.slice(0, 8)}…` : null,
      });
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [app]);

  useEffect(() => {
    console.info("[auth-debug][app-provider]", {
      apiKeyPresent: Boolean(apiKey),
      hostPresent: Boolean(host),
    });
  }, [apiKey, host]);

  return null;
}

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const hostParam = url.searchParams.get("host");
  const shopParam = url.searchParams.get("shop");
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization") || null;

  logAuthDebug("loader:start", {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    hostParam: hostParam || null,
    shopParam: shopParam || null,
    hasAuthHeader: Boolean(authHeader),
  });

  try {
    const auth = await authenticate.admin(request);
    const { session, headers, ...rest } = auth ?? {};

    logAuthDebug("loader:success", {
      sessionShop: session?.shop ?? null,
      sessionId: session?.id ?? null,
      sessionIsOnline: session?.isOnline ?? null,
      extraKeys: rest ? Object.keys(rest) : [],
      returnedHeaders: serializeHeaders(headers),
    });

    const resolvedHost = session?.host ?? hostParam ?? null;
    const data = {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      host: resolvedHost,
      shop: session?.shop ?? shopParam ?? null,
    };

    logAuthDebug("loader:response", {
      resolvedHost,
      hasApiKey: Boolean(data.apiKey),
    });

    if (!resolvedHost) {
      logAuthDebug("loader:missing-host", {
        message: "Host parameter could not be resolved.",
      });
      throw new Response("Missing host parameter", { status: 400 });
    }

    return json(data, headers ? { headers } : {});
  } catch (error) {
    if (error instanceof Response) {
      logAuthDebug("loader:redirect", {
        status: error.status,
        statusText: error.statusText,
        location: error.headers.get("Location"),
        headers: serializeHeaders(error.headers),
      });
      throw error;
    }

    logAuthDebug("loader:error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    throw error;
  }
};

export default function App() {
  const { apiKey, host } = useLoaderData();
  const maskedKey = useMemo(() => (apiKey ? `${apiKey.slice(0, 6)}***` : null), [apiKey]);

  useEffect(() => {
    console.info("[auth-debug][app-provider:config]", { apiKey: maskedKey, host });
  }, [maskedKey, host]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey} host={host}>
      <AppBridgeDiagnostics apiKey={apiKey} host={host} />
      <NavMenu>
        <Link to="/app" rel="home" aria-label="Dashboard">
          Dashboard
        </Link>
        <Link to="/app/scripts" aria-label="Scripts">
          Scripts
        </Link>
        <Link to="/app/settings" aria-label="Settings">
          Settings
        </Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
