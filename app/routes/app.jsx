import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { resolveShopifyHost } from "../utils/host.server";
import AppBridgeDiagnostics from "../components/AppBridgeDiagnostics";

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

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const hostParam = url.searchParams.get("host");
  const shopParam = url.searchParams.get("shop");
  const idTokenParam = url.searchParams.get("id_token");
  const embeddedParam = url.searchParams.get("embedded");
  const authHeader =
    request.headers.get("Authorization") || request.headers.get("authorization") || null;
  const secFetchDest = request.headers.get("sec-fetch-dest");
  const headerKeys = Array.from(request.headers.keys());

  logAuthDebug("loader:start", {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    hostParam: hostParam || null,
    shopParam: shopParam || null,
    embedded: embeddedParam || null,
    hasIdTokenParam: Boolean(idTokenParam),
    hasAuthHeader: Boolean(authHeader),
    secFetchDest,
    headerKeys,
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

    const { host: resolvedHost, setCookie, source: hostSource } = await resolveShopifyHost(
      request,
      session?.host ?? null,
    );

    const data = {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      host: resolvedHost,
      shop: session?.shop ?? shopParam ?? null,
    };

    logAuthDebug("loader:response", {
      resolvedHost: Boolean(resolvedHost),
      hostSource,
      hasApiKey: Boolean(data.apiKey),
      shop: data.shop,
    });

    const responseHeaders = headers ? new Headers(headers) : new Headers();
    if (setCookie) {
      responseHeaders.append("Set-Cookie", setCookie);
      logAuthDebug("loader:host-cookie", { applied: true });
    }

    return json(data, responseHeaders.size ? { headers: responseHeaders } : {});
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
  const { apiKey, host, shop } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <AppBridgeDiagnostics apiKey={apiKey} host={host} shop={shop} />
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
